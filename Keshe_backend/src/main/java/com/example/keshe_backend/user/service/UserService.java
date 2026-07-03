package com.example.keshe_backend.user.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.transaction.entity.Transaction;
import com.example.keshe_backend.transaction.repository.TransactionRepository;
import com.example.keshe_backend.user.dto.*;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    /**
     * 获取用户公开资料
     */
    public UserProfileResponse getUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        return UserProfileResponse.from(user);
    }

    /**
     * 修改手机号
     */
    @Transactional
    public UserProfileResponse updatePhone(String phone) {
        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        if (userRepository.existsByPhone(phone)) {
            throw new BusinessException(ErrorCode.PHONE_EXISTS);
        }

        user.setPhone(phone);
        userRepository.save(user);
        return UserProfileResponse.from(user);
    }

    /**
     * 修改邮箱
     */
    @Transactional
    public UserProfileResponse updateEmail(String email) {
        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        // 空邮箱统一存 null 而非 ""，避免撞 email 唯一约束（同 register）
        String normalized = (email != null && !email.isBlank()) ? email : null;
        if (normalized != null && userRepository.existsByEmail(normalized)) {
            throw new BusinessException(ErrorCode.EMAIL_EXISTS);
        }

        user.setEmail(normalized);
        userRepository.save(user);
        return UserProfileResponse.from(user);
    }

    /**
     * 提交实名认证
     */
    @Transactional
    public UserProfileResponse submitAuth(String realName, String studentId, String college, String className) {
        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        user.setRealName(realName);
        user.setStudentId(studentId);
        user.setCollege(college);
        if (className != null && !className.isEmpty()) {
            user.setClassName(className);
        }
        user.setAuthStatus(1); // 标记为已认证

        userRepository.save(user);
        return UserProfileResponse.from(user);
    }

    /**
     * 查询余额
     */
    public BalanceResponse getBalance() {
        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
        return new BalanceResponse(user.getBalance());
    }

    /**
     * 充值
     */
    @Transactional
    public BalanceResponse recharge(BigDecimal amount) {
        if (amount == null || amount.compareTo(new BigDecimal("0.01")) < 0
                || amount.compareTo(new BigDecimal("100000")) > 0) {
            throw new BusinessException(ErrorCode.RECHARGE_AMOUNT_INVALID);
        }

        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        user.setBalance(user.getBalance().add(amount));
        userRepository.save(user);

        // 创建充值流水
        Transaction tx = new Transaction();
        tx.setUserId(userId);
        tx.setDirection("in");
        tx.setAmount(amount);
        tx.setCategory("recharge");
        tx.setNote("账户充值");
        transactionRepository.save(tx);

        return new BalanceResponse(user.getBalance());
    }

    /**
     * 获取账单流水
     */
    public BillsResponse getBills() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<Transaction> transactions = transactionRepository.findByUserIdOrderByCreatedAtDesc(userId);

        BigDecimal totalIn = BigDecimal.ZERO;
        BigDecimal totalOut = BigDecimal.ZERO;
        List<BillItemResponse> list = new ArrayList<>();

        for (Transaction tx : transactions) {
            if ("in".equals(tx.getDirection())) {
                totalIn = totalIn.add(tx.getAmount());
            } else {
                totalOut = totalOut.add(tx.getAmount());
            }
            list.add(BillItemResponse.builder()
                    .id(tx.getId())
                    .userId(tx.getUserId())
                    .direction(tx.getDirection())
                    .amount(tx.getAmount())
                    .category(tx.getCategory())
                    .relatedId(tx.getRelatedId())
                    .note(tx.getNote())
                    .time(tx.getCreatedAt())
                    .build());
        }

        return BillsResponse.builder()
                .list(list)
                .totalIn(totalIn)
                .totalOut(totalOut)
                .build();
    }
}
