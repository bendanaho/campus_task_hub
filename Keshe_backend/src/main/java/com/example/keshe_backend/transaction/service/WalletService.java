package com.example.keshe_backend.transaction.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.transaction.entity.Transaction;
import com.example.keshe_backend.transaction.repository.TransactionRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * 资金托管原语：把"冻结/释放/退款"收敛到三个守恒操作，供发布、订单、聊天转账复用。
 * 不变式：任一操作后，全系统 (Σbalance + Σfrozen) 不变。
 *  - hold:    from.balance -= X;  from.frozen += X        （本人内部转移，总额不变）
 *  - release: from.frozen  -= X;  to.balance  += X        （冻结转出到对方可用）
 *  - refund:  from.frozen  -= X;  from.balance += X        （冻结退回本人可用）
 */
@Service
@RequiredArgsConstructor
public class WalletService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    private static BigDecimal nz(BigDecimal b) { return b == null ? BigDecimal.ZERO : b; }

    /**
     * related_id 的作用域前缀。
     * 此前发布冻结存帖子 id、接单冻结存订单 id，两者同为 category="escrow_freeze"，
     * 于是"帖子12"和"订单12"撞号——账单页只按 relatedId 分组（不看 category），
     * 会把两笔毫不相干的钱并进同一条账单。加前缀后彻底区分。
     */
    public static String relPost(Long postId)   { return "post:" + postId; }
    public static String relOrder(Long orderId) { return "order:" + orderId; }
    public static String relMsg(Long msgId)     { return "msg:" + msgId; }

    private User load(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
    }

    private void tx(Long userId, String direction, BigDecimal amount, String category, String relatedId, String note) {
        Transaction t = new Transaction();
        t.setUserId(userId);
        t.setDirection(direction);
        t.setAmount(amount);
        t.setCategory(category);
        t.setRelatedId(relatedId);
        t.setNote(note);
        transactionRepository.save(t);
    }

    /** 冻结：校验可用余额充足，把 X 从可用转入冻结。 */
    @Transactional
    public void hold(Long fromUserId, BigDecimal amount, String category, String relatedId, String note) {
        if (amount == null || amount.signum() <= 0) return;
        User u = load(fromUserId);
        if (u.getBalance().compareTo(amount) < 0) {
            throw new BusinessException(ErrorCode.BALANCE_NOT_ENOUGH);
        }
        u.setBalance(u.getBalance().subtract(amount));
        u.setFrozenBalance(nz(u.getFrozenBalance()).add(amount));
        userRepository.save(u);
        tx(fromUserId, "out", amount, category, relatedId, note);
    }

    /** 释放：from 的冻结转出为 to 的可用余额（订单完成/结算给对方）。 */
    @Transactional
    public void release(Long fromUserId, Long toUserId, BigDecimal amount, String category, String relatedId, String note) {
        if (amount == null || amount.signum() <= 0) return;
        User from = load(fromUserId);
        from.setFrozenBalance(nz(from.getFrozenBalance()).subtract(amount));
        userRepository.save(from);
        User to = load(toUserId);
        to.setBalance(to.getBalance().add(amount));
        userRepository.save(to);
        tx(toUserId, "in", amount, category, relatedId, note);
    }

    /** 退款：from 的冻结退回本人可用余额（取消/退款）。 */
    @Transactional
    public void refund(Long fromUserId, BigDecimal amount, String category, String relatedId, String note) {
        if (amount == null || amount.signum() <= 0) return;
        User u = load(fromUserId);
        u.setFrozenBalance(nz(u.getFrozenBalance()).subtract(amount));
        u.setBalance(u.getBalance().add(amount));
        userRepository.save(u);
        tx(fromUserId, "in", amount, category, relatedId, note);
    }
}
