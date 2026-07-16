package com.example.keshe_backend.common.sweep;

import static com.example.keshe_backend.transaction.service.WalletService.relOrder;
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
    /** 待接受订单超过这么多天未被接受 → 自动取消并退款，避免付款方的钱被无限期冻住 */
    private static final int PENDING_EXPIRE_DAYS = 3;

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final TaskRepository taskRepository;
    private final ReviewRepository reviewRepository;
    private final com.example.keshe_backend.transaction.service.WalletService walletService;
    private final com.example.keshe_backend.chat.service.ChatService chatService;
    private final com.example.keshe_backend.review.service.ReviewService reviewService;

    /**
     * 业务方法在读取敏感数据前显式调用此方法进行清理。
     */
    public void sweep() {
        expirePendingSweep();
        autoConfirmSweep();
        ensureDefaultReviews();
    }

    /**
     * 待接受订单超时自动取消并退款。
     *
     * 下单时就冻结付款方的钱（见 OrderService.createOrder），若对方一直不接受，
     * 这笔钱会无限期冻着——余额里看不见、花不出去，而买家未必意识到该去哪解开。
     * 此前系统只对 in_progress 做超时自动确认，pending 完全没有兜底。
     *
     * 只取消、退款，不做任何结算，对双方都无损。
     */
    @Transactional
    public void expirePendingSweep() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(PENDING_EXPIRE_DAYS);
        List<Order> expired = orderRepository.findByStatusAndCreatedAtBefore("pending", cutoff);
        for (Order order : expired) {
            log.info("待接受订单超时自动取消: id={}, createdAt={}", order.getId(), order.getCreatedAt());
            order.setStatus("cancelled");
            orderRepository.save(order);

            Task post = taskRepository.findById(order.getPostId()).orElse(null);
            String title = post != null ? post.getTitle() : "";
            // 退回下单时冻结的钱。悬赏帖(payer)的报酬冻在【帖子】上（发布时冻结）、
            // 不随订单取消退回，帖子还挂着等下一个人接——与 OrderService 同一条规则。
            BigDecimal amount = order.getAmount();
            if (post != null && !"payer".equals(post.getPublisherSide())
                    && amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                walletService.refund(order.getPayerId(), amount, "escrow_refund", relOrder(order.getId()),
                        "待接受超时自动取消，退回冻结报酬：" + title);
            }
            chatService.addSystemMessage(order.getChatId(),
                    "该订单超过 " + PENDING_EXPIRE_DAYS + " 天未被接受，已自动取消"
                            + (amount != null && amount.compareTo(BigDecimal.ZERO) > 0 ? "，冻结的报酬已退回付款方" : ""),
                    String.valueOf(order.getPostId()), title);
        }
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
            Task swPost = taskRepository.findById(order.getPostId()).orElse(null);
            String swTitle = swPost != null ? swPost.getTitle() : "";
            String earnerName = "对方";
            if (amount.compareTo(BigDecimal.ZERO) > 0) {
                User earner = userRepository.findById(order.getEarnerId()).orElse(null);
                if (earner != null) earnerName = earner.getUsername();
                // 结算：释放冻结的报酬（付款方 frozen → 收款方 balance），保持资金守恒
                walletService.release(order.getPayerId(), order.getEarnerId(), amount, "order",
                        relOrder(order.getId()), "订单收入：" + swTitle + "（自动确认）");
            }
            // 释放该会话托管中的私信转账给各自接收方
            chatService.releaseEscrowedTransfers(order.getChatId());

            orderRepository.save(order);

            // 系统消息：超时自动确认
            chatService.addSystemMessage(order.getChatId(), amount.compareTo(BigDecimal.ZERO) > 0
                    ? ("已超时自动确认，报酬 " + amount.stripTrailingZeros().toPlainString() + " 元已结算给 " + earnerName)
                    : "已超时自动确认，任务完成", String.valueOf(order.getPostId()), swTitle);
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
        reviewService.recalcCreditScore(toUserId);   // 默认好评也计入被评价者信用分
        log.info("生成默认好评: orderId={}, from={}, to={}", order.getId(), fromUserId, toUserId);
    }

    /**
     * 定时任务：每 5 分钟执行一次清理。
     */
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void scheduledSweep() {
        log.debug("定时清理开始...");
        expirePendingSweep();
        autoConfirmSweep();
        ensureDefaultReviews();
    }
}
