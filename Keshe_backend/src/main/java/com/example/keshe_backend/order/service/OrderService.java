package com.example.keshe_backend.order.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.order.dto.CreateOrderRequest;
import com.example.keshe_backend.order.dto.MyOrderResponse;
import com.example.keshe_backend.order.dto.OrderDTO;
import com.example.keshe_backend.order.entity.Order;
import com.example.keshe_backend.order.repository.OrderRepository;
import com.example.keshe_backend.post.dto.PostDTO;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.transaction.entity.Transaction;
import com.example.keshe_backend.transaction.repository.TransactionRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final int AUTO_DAYS = 2;

    private final OrderRepository orderRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    /**
     * 创建订单（响应帖子）
     */
    @Transactional
    public OrderDTO createOrder(CreateOrderRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        User currentUser = requireVerified(userId);

        Task post = taskRepository.findById(request.getPostId())
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));

        // 不能自己接自己的帖子
        if (post.getPublisherId().equals(userId)) {
            throw new BusinessException(ErrorCode.SELF_DEALING);
        }

        // 悬赏帖过截止时间
        if ("payer".equals(post.getPublisherSide())
                && post.getDeadline() != null
                && post.getDeadline().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.POST_EXPIRED);
        }

        // 帖子已关闭
        if ("closed".equals(post.getStatus())) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED);
        }

        // 悬赏帖(payer)：同时只能有一个活跃订单
        if ("payer".equals(post.getPublisherSide())) {
            List<Order> active = orderRepository.findByPostIdAndStatusIn(
                    request.getPostId(), Arrays.asList("pending", "in_progress"));
            if (!active.isEmpty()) {
                throw new BusinessException(ErrorCode.DUPLICATE_ORDER);
            }
        }

        // 确定 payer/earner 和金额
        Long payerId, earnerId;
        BigDecimal amount;
        String side = post.getPublisherSide();

        if ("payer".equals(side)) {
            // 发布者是付款方，接单者是收款方
            payerId = post.getPublisherId();
            earnerId = userId;
            amount = post.getRewardValue();
        } else if ("earner".equals(side)) {
            // 发布者是收款方，接单者是付款方
            payerId = userId;
            earnerId = post.getPublisherId();
            amount = post.getRewardValue();
        } else {
            // none：纯互助，金额为 0，角色按 earner（发布者收 0 元）
            payerId = userId;
            earnerId = post.getPublisherId();
            amount = BigDecimal.ZERO;
        }

        Order order = new Order();
        order.setChatId(request.getChatId());
        order.setPostId(request.getPostId());
        order.setPayerId(payerId);
        order.setEarnerId(earnerId);
        order.setAmount(amount);
        order.setStatus("pending");
        order = orderRepository.save(order);

        return OrderDTO.from(order);
    }

    /**
     * 接受订单（发布者操作）
     */
    @Transactional
    public OrderDTO acceptOrder(Long orderId) {
        Long userId = SecurityUtils.getCurrentUserId();
        requireVerified(userId);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在"));

        if (!"pending".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_ORDER_STATUS);
        }

        Task post = taskRepository.findById(order.getPostId())
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));

        // 只有帖子发布者才能接受订单
        if (!post.getPublisherId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        BigDecimal amount = order.getAmount();
        LocalDateTime now = LocalDateTime.now();

        // 冻结付款方余额（纯互助跳过）
        if (amount.compareTo(BigDecimal.ZERO) > 0) {
            User payer = userRepository.findById(order.getPayerId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "付款方不存在"));
            if (payer.getBalance().compareTo(amount) < 0) {
                throw new BusinessException(ErrorCode.BALANCE_NOT_ENOUGH);
            }
            payer.setBalance(payer.getBalance().subtract(amount));
            userRepository.save(payer);

            // 创建交易流水（支出）
            Transaction tx = new Transaction();
            tx.setUserId(order.getPayerId());
            tx.setDirection("out");
            tx.setAmount(amount);
            tx.setCategory("order");
            tx.setRelatedId(order.getId().toString());
            tx.setNote("订单支付：" + post.getTitle());
            transactionRepository.save(tx);
        }

        order.setStatus("in_progress");
        order.setAcceptedAt(now);

        // 悬赏帖（payer）：关闭帖子
        if ("payer".equals(post.getPublisherSide())) {
            post.setStatus("closed");
            taskRepository.save(post);
        }

        orderRepository.save(order);
        return OrderDTO.from(order);
    }

    /**
     * 取消订单（仅 pending 状态可取消）
     */
    @Transactional
    public OrderDTO cancelOrder(Long orderId) {
        Long userId = SecurityUtils.getCurrentUserId();
        requireVerified(userId);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在"));

        if (!"pending".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_ORDER_STATUS);
        }

        // 付款方或收款方都可以取消
        if (!order.getPayerId().equals(userId) && !order.getEarnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        order.setStatus("cancelled");
        orderRepository.save(order);
        return OrderDTO.from(order);
    }

    /**
     * 确认完成
     */
    @Transactional
    public OrderDTO confirmOrder(Long orderId) {
        Long userId = SecurityUtils.getCurrentUserId();
        requireVerified(userId);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在"));

        if (!"in_progress".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_ORDER_STATUS);
        }

        LocalDateTime now = LocalDateTime.now();

        // 设置确认标志
        if (order.getPayerId().equals(userId)) {
            order.setPayerConfirmed(true);
        } else if (order.getEarnerId().equals(userId)) {
            order.setEarnerConfirmed(true);
        } else {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        // 检查是否双方都已确认
        if (Boolean.TRUE.equals(order.getPayerConfirmed())
                && Boolean.TRUE.equals(order.getEarnerConfirmed())) {
            // 完成订单
            order.setStatus("completed");
            order.setCompletedAt(now);
            order.setReviewDeadline(now.plusDays(AUTO_DAYS));

            // 结算给收款方
            BigDecimal amount = order.getAmount();
            if (amount.compareTo(BigDecimal.ZERO) > 0) {
                User earner = userRepository.findById(order.getEarnerId())
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "收款方不存在"));
                earner.setBalance(earner.getBalance().add(amount));
                userRepository.save(earner);

                Task post = taskRepository.findById(order.getPostId()).orElse(null);
                Transaction tx = new Transaction();
                tx.setUserId(order.getEarnerId());
                tx.setDirection("in");
                tx.setAmount(amount);
                tx.setCategory("order");
                tx.setRelatedId(order.getId().toString());
                tx.setNote("订单收入：" + (post != null ? post.getTitle() : ""));
                transactionRepository.save(tx);
            }
        } else {
            // 单方确认：设置自动确认时间
            order.setAutoConfirmAt(now.plusDays(AUTO_DAYS));
        }

        orderRepository.save(order);
        return OrderDTO.from(order);
    }

    /**
     * 按 chatId 查活跃订单
     */
    public OrderDTO getActiveOrder(String chatId) {
        Long userId = SecurityUtils.getCurrentUserId();
        Order order = orderRepository.findTopByChatIdOrderByCreatedAtDesc(chatId).orElse(null);
        if (order != null) {
            if (!order.getPayerId().equals(userId) && !order.getEarnerId().equals(userId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "不是订单参与者");
            }
            return OrderDTO.from(order);
        }
        return null;
    }

    /**
     * 按 chatId 查订单历史
     */
    public List<OrderDTO> getOrderHistory(String chatId) {
        Long userId = SecurityUtils.getCurrentUserId();
        List<Order> orders = orderRepository.findByChatIdOrderByCreatedAtAsc(chatId);
        // 验证用户参与该会话的至少一个订单
        if (!orders.isEmpty()) {
            Order first = orders.get(0);
            if (!first.getPayerId().equals(userId) && !first.getEarnerId().equals(userId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "不是订单参与者");
            }
        }
        return orders.stream().map(OrderDTO::from).collect(Collectors.toList());
    }

    /**
     * 我的订单
     */
    public List<MyOrderResponse> getMyOrders(String role) {
        Long userId = SecurityUtils.getCurrentUserId();

        List<Order> orders;
        if ("payer".equals(role)) {
            orders = orderRepository.findByPayerIdOrderByCreatedAtDesc(userId);
        } else if ("earner".equals(role)) {
            orders = orderRepository.findByEarnerIdOrderByCreatedAtDesc(userId);
        } else {
            orders = orderRepository.findByPayerIdOrEarnerIdOrderByCreatedAtDesc(userId, userId);
        }

        List<MyOrderResponse> result = new ArrayList<>();
        for (Order order : orders) {
            Task post = taskRepository.findById(order.getPostId()).orElse(null);
            String myRole;
            Long partnerId;
            String partnerName;

            if (order.getPayerId().equals(userId)) {
                myRole = "payer";
                partnerId = order.getEarnerId();
            } else {
                myRole = "earner";
                partnerId = order.getPayerId();
            }

            User partner = userRepository.findById(partnerId).orElse(null);
            partnerName = partner != null ? partner.getUsername() : "";

            result.add(MyOrderResponse.builder()
                    .order(OrderDTO.from(order))
                    .post(post != null ? PostDTO.from(post) : null)
                    .title(post != null ? post.getTitle() : "")
                    .myRole(myRole)
                    .partnerId(partnerId)
                    .partnerName(partnerName)
                    .build());
        }
        return result;
    }

    private User requireVerified(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
        if (user.getAuthStatus() == null || user.getAuthStatus() != 1) {
            throw new BusinessException(ErrorCode.VERIFICATION_REQUIRED);
        }
        return user;
    }
}
