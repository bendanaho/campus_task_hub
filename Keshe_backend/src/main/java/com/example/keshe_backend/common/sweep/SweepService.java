package com.example.keshe_backend.common.sweep;

import com.example.keshe_backend.order.entity.Order;
import com.example.keshe_backend.order.repository.OrderRepository;
import com.example.keshe_backend.review.entity.Review;
import com.example.keshe_backend.review.repository.ReviewRepository;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.transaction.entity.Transaction;
import com.example.keshe_backend.transaction.repository.TransactionRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 懒清理服务：自动确认超时订单 + 自动生成默认好评。
 * 复制 JS 端 _sweep() 逻辑。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SweepService {

    private static final int AUTO_DAYS = 2;

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final TaskRepository taskRepository;
    private final ReviewRepository reviewRepository;

    /**
     * 业务方法在读取敏感数据前显式调用此方法进行清理。
     */
    public void sweep() {
        autoConfirmSweep();
        ensureDefaultReviews();
    }

    /**
     * 自动确认：遍历 in_progress 且 autoConfirmAt 已过期的订单，自动完成并结算。
     */
    @Transactional
    public void autoConfirmSweep() {
        LocalDateTime now = LocalDateTime.now();
        List<Order> pending = orderRepository.findByStatusAndAutoConfirmAtBefore("in_progress", now);

        for (Order order : pending) {
            log.info("自动确认订单: id={}, autoConfirmAt={}", order.getId(), order.getAutoConfirmAt());

            order.setStatus("completed");
            order.setPayerConfirmed(true);
            order.setEarnerConfirmed(true);
            order.setCompletedAt(now);
            order.setReviewDeadline(now.plusDays(AUTO_DAYS));

            // 结算给收款方
            BigDecimal amount = order.getAmount();
            if (amount.compareTo(BigDecimal.ZERO) > 0) {
                User earner = userRepository.findById(order.getEarnerId()).orElse(null);
                if (earner != null) {
                    earner.setBalance(earner.getBalance().add(amount));
                    userRepository.save(earner);

                    Task post = taskRepository.findById(order.getPostId()).orElse(null);
                    Transaction tx = new Transaction();
                    tx.setUserId(order.getEarnerId());
                    tx.setDirection("in");
                    tx.setAmount(amount);
                    tx.setCategory("order");
                    tx.setRelatedId(order.getId().toString());
                    tx.setNote("订单收入：" + (post != null ? post.getTitle() : "") + "（自动确认）");
                    transactionRepository.save(tx);
                }
            }

            orderRepository.save(order);
        }

        if (!pending.isEmpty()) {
            log.info("自动确认了 {} 个订单", pending.size());
        }
    }

    /**
     * 默认好评：遍历已完成且评价截止时间已过期的订单，为未评价方生成 5 星默认评价。
     */
    @Transactional
    public void ensureDefaultReviews() {
        LocalDateTime now = LocalDateTime.now();
        List<Order> completed = orderRepository.findByStatusAndReviewDeadlineBefore("completed", now);

        for (Order order : completed) {
            // payer → earner
            ensureOneDefaultReview(order, order.getPayerId(), order.getEarnerId());
            // earner → payer
            ensureOneDefaultReview(order, order.getEarnerId(), order.getPayerId());
        }

        if (!completed.isEmpty()) {
            log.info("检查了 {} 个已完成订单的默认评价", completed.size());
        }
    }

    private void ensureOneDefaultReview(Order order, Long fromUserId, Long toUserId) {
        // 已有真实评价则跳过
        if (reviewRepository.existsByOrderIdAndFromUserId(order.getId(), fromUserId)) {
            return;
        }

        User fromUser = userRepository.findById(fromUserId).orElse(null);
        User toUser = userRepository.findById(toUserId).orElse(null);
        if (fromUser == null || toUser == null) return;

        Review review = new Review();
        review.setOrderId(order.getId());
        review.setTaskId(order.getPostId());
        review.setFromUserId(fromUserId);
        review.setFromUserName(fromUser.getUsername());
        review.setToUserId(toUserId);
        review.setToUserName(toUser.getUsername());
        review.setRating(5);
        review.setContent("（用户未评价，默认好评）");
        review.setAutoReview(true);
        review.setCreatedAt(LocalDateTime.now());

        reviewRepository.save(review);
        log.info("生成默认好评: orderId={}, from={}, to={}", order.getId(), fromUserId, toUserId);
    }

    /**
     * 定时任务：每 5 分钟执行一次清理。
     */
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void scheduledSweep() {
        log.debug("定时清理开始...");
        autoConfirmSweep();
        ensureDefaultReviews();
    }
}
