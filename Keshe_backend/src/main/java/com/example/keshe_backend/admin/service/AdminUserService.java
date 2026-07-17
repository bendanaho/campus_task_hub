package com.example.keshe_backend.admin.service;

import com.example.keshe_backend.admin.dto.AdminResetPasswordResponse;
import com.example.keshe_backend.admin.dto.AdminUserItemResponse;
import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 管理员的用户管理：只做"看列表"和"人工重置密码"两件事。
 *
 * 存在的理由：24 个存量用户里有 16 个没绑邮箱，自助找回覆盖不到他们。
 * 管理员线下核实身份后重置，是这批人唯一的兜底路径。
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);

    /**
     * 临时密码字符集：去掉了 0/O/o、1/l/I 这类看着一样的字符。
     * 这串密码要靠管理员口头或转发告诉用户、再由用户手敲，认错一个字符就白折腾。
     */
    private static final String TEMP_PASSWORD_CHARS =
            "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int TEMP_PASSWORD_LENGTH = 10;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    public List<AdminUserItemResponse> listUsers() {
        return userRepository.findByDeletedAtIsNullOrderByIdAsc().stream()
                .map(u -> AdminUserItemResponse.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .phone(maskPhone(u.getPhone()))
                        .hasEmail(u.getEmail() != null && !u.getEmail().isBlank())
                        .authStatus(u.getAuthStatus())
                        .role(u.getRole())
                        .createdAt(u.getCreatedAt() == null ? null : u.getCreatedAt().format(FMT))
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * 重置指定用户的密码为随机临时密码，返回明文（仅此一次）。
     *
     * 这个操作等于把账号交给管理员——重置后管理员可以用临时密码登录该用户、动其余额。
     * 这是兜底功能的固有代价，无法既让管理员能救人、又让他碰不到账号。
     * 因此这里留审计日志：谁在什么时候重置了谁，事后可查。
     */
    @Transactional
    public AdminResetPasswordResponse resetPassword(Long targetUserId) {
        Long adminId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        if (user.getDeletedAt() != null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }

        String temp = randomPassword();
        user.setPasswordHash(passwordEncoder.encode(temp));
        // 顶掉该用户所有旧会话：如果重置的起因就是"号被人占了"，不顶掉等于没重置
        user.setTokenVersion((user.getTokenVersion() == null ? 0 : user.getTokenVersion()) + 1);
        userRepository.save(user);

        // 审计留痕。只记 id，不记临时密码本身——密码进了日志就等于长期留存明文。
        log.warn("管理员 {} 重置了用户 {}（{}）的密码", adminId, user.getId(), user.getUsername());

        return new AdminResetPasswordResponse(user.getId(), user.getUsername(), temp);
    }

    private String randomPassword() {
        StringBuilder sb = new StringBuilder(TEMP_PASSWORD_LENGTH);
        for (int i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
            sb.append(TEMP_PASSWORD_CHARS.charAt(random.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }

    /** 管理员核实身份时需要认人，但没必要看到完整号码 */
    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return phone;
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }
}
