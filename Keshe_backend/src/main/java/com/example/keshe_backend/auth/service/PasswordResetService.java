package com.example.keshe_backend.auth.service;

import com.example.keshe_backend.auth.dto.ResetPasswordRequest;
import com.example.keshe_backend.auth.dto.SendResetCodeRequest;
import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.mail.MailService;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 邮箱验证码找回密码。
 *
 * 验证码只存内存：进程重启即失效。可接受——有效期本来就只有 5 分钟，重来一次即可；
 * 换来的是不落库、不留痕，也不必为它加表。单实例部署，无需考虑多节点共享。
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private static final int CODE_TTL_MINUTES = 5;
    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_VERIFY_ATTEMPTS = 5;
    private static final int SEND_WINDOW_MINUTES = 15;
    private static final int MAX_SENDS_PER_WINDOW = 5;
    private static final int MIN_PASSWORD_LENGTH = 6;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;

    private final SecureRandom random = new SecureRandom();
    private final Map<Long, CodeEntry> codes = new ConcurrentHashMap<>();
    private final Map<String, SendWindow> sendWindows = new ConcurrentHashMap<>();

    private static class CodeEntry {
        String code;
        Instant expireAt;
        Instant sentAt;
        int attempts;
    }

    private static class SendWindow {
        Instant windowStart;
        int count;
    }

    /**
     * 发验证码。
     *
     * 账号与邮箱两样都要，不只要邮箱：只凭邮箱就能发码的话，任何人拿一份邮箱列表就能
     * 逐个探测"这个邮箱在本站注册过没有"。两样都对才发，探测成本高得多。
     */
    public void sendCode(SendResetCodeRequest request, String clientIp) {
        User user = resolve(request.getAccount(), request.getEmail())
                .orElseThrow(() -> new BusinessException(ErrorCode.RESET_INFO_MISMATCH));

        CodeEntry existing = codes.get(user.getId());
        if (existing != null && existing.sentAt != null
                && existing.sentAt.plusSeconds(RESEND_COOLDOWN_SECONDS).isAfter(Instant.now())) {
            throw new BusinessException(ErrorCode.RESET_CODE_COOLDOWN);
        }

        checkSendRateLimit(user.getId(), clientIp);

        String code = String.format("%06d", random.nextInt(1_000_000));
        CodeEntry entry = new CodeEntry();
        entry.code = code;
        entry.expireAt = Instant.now().plusSeconds(CODE_TTL_MINUTES * 60L);
        entry.sentAt = Instant.now();
        entry.attempts = 0;
        codes.put(user.getId(), entry);

        try {
            mailService.sendResetCode(user.getEmail(), code, CODE_TTL_MINUTES);
        } catch (RuntimeException e) {
            // 发失败就把码删掉，否则用户收不到却还占着 60 秒冷却，只能干等
            codes.remove(user.getId());
            throw e;
        }
    }

    /**
     * 校验验证码并改密码。
     *
     * 验证码和新密码在同一个请求里提交（而不是"先验码换一次性令牌、再拿令牌改密"），
     * 少一个接口、少一份令牌状态：验证码本身就是那个一次性凭证，再包一层没有额外收益。
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "两次输入的密码不一致");
        }
        if (request.getNewPassword().length() < MIN_PASSWORD_LENGTH) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "密码长度不能少于 " + MIN_PASSWORD_LENGTH + " 位");
        }

        User user = resolve(request.getAccount(), request.getEmail())
                .orElseThrow(() -> new BusinessException(ErrorCode.RESET_INFO_MISMATCH));

        CodeEntry entry = codes.get(user.getId());
        if (entry == null || entry.expireAt.isBefore(Instant.now())) {
            codes.remove(user.getId());
            throw new BusinessException(ErrorCode.RESET_CODE_INVALID);
        }

        entry.attempts++;
        if (entry.attempts > MAX_VERIFY_ATTEMPTS || !constantTimeEquals(entry.code, request.getCode())) {
            // 猜错够 5 次就把码作废，逼对方重新发一封。配合"15 分钟最多发 5 封"，
            // 15 分钟内至多 25 次猜测，对 6 位数字（100 万种）来说毫无威胁。
            // 刻意不锁账号：锁了的话，攻击者故意猜错就能把真正的机主挡在找回流程之外。
            if (entry.attempts > MAX_VERIFY_ATTEMPTS) {
                codes.remove(user.getId());
            }
            throw new BusinessException(ErrorCode.RESET_CODE_INVALID);
        }

        codes.remove(user.getId());
        applyNewPassword(user, request.getNewPassword());
        log.info("用户 {} 通过邮箱验证码重置了密码", user.getId());
    }

    /**
     * 落新密码并顶掉旧会话。tokenVersion +1 之后，该用户此前签发的所有 JWT 全部失效。
     * 找回密码最要紧的场景就是"号被人拿了"，不顶掉旧会话，攻击者改完还在里面。
     */
    private void applyNewPassword(User user, String rawPassword) {
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setTokenVersion((user.getTokenVersion() == null ? 0 : user.getTokenVersion()) + 1);
        userRepository.save(user);
    }

    /** 账号（用户名/手机号/邮箱任一）+ 绑定邮箱都对上才算数；未绑邮箱的一律不给过。 */
    private Optional<User> resolve(String account, String email) {
        if (account == null || email == null) return Optional.empty();
        Optional<User> found = userRepository.findByUsername(account)
                .or(() -> userRepository.findByPhone(account))
                .or(() -> userRepository.findByEmail(account));
        return found.filter(u -> u.getEmail() != null
                && !u.getEmail().isBlank()
                && u.getEmail().equalsIgnoreCase(email.trim())
                && u.getDeletedAt() == null);
    }

    private void checkSendRateLimit(Long userId, String clientIp) {
        String key = userId + "@" + (clientIp == null ? "?" : clientIp);
        Instant now = Instant.now();
        SendWindow w = sendWindows.compute(key, (k, cur) -> {
            if (cur == null || cur.windowStart.plusSeconds(SEND_WINDOW_MINUTES * 60L).isBefore(now)) {
                SendWindow fresh = new SendWindow();
                fresh.windowStart = now;
                fresh.count = 0;
                return fresh;
            }
            return cur;
        });
        synchronized (w) {
            if (w.count >= MAX_SENDS_PER_WINDOW) {
                throw new BusinessException(ErrorCode.RESET_TOO_MANY);
            }
            w.count++;
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    /** 过期条目清理：没有它，codes/sendWindows 会随时间单调增长。 */
    @Scheduled(fixedDelay = 600_000)
    public void purgeExpired() {
        Instant now = Instant.now();
        codes.entrySet().removeIf(e -> e.getValue().expireAt.isBefore(now));
        sendWindows.entrySet().removeIf(
                e -> e.getValue().windowStart.plusSeconds(SEND_WINDOW_MINUTES * 60L).isBefore(now));
    }
}
