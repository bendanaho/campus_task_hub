package com.example.keshe_backend.order.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.order.dto.AdminOrderItemResponse;
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
    private final com.example.keshe_backend.chat.service.ChatService chatService;

    // 金额格式化：25.00 → "25"，避免系统消息里出现多余小数
    private static String fmt(BigDecimal amount) {
        return amount.stripTrailingZeros().toPlainString();
    }
    private String nameOf(Long userId) {
        return userRepository.findById(userId).map(User::getUsername).orElse("对方");
    }

    /**
     * 创建订单（响应帖子）
     */
    @Transactional
    public OrderDTO createOrder(CreateOrderRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        User currentUser = requireVerified(userId);
        // 管理员为纯管理角色，不参与交易（与仲裁权分离，避免利益冲突）
        if (currentUser.getRole() != null && currentUser.getRole() == 1) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "管理员账号不参与交易");
        }

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

        // 系统消息：响应方发起订单
        String createText = "none".equals(side) ? (currentUser.getUsername() + " 申请参加，等待发起者接受")
                : ("earner".equals(side) ? (currentUser.getUsername() + " 发起下单，等待对方接受")
                : (currentUser.getUsername() + " 申请接单，等待对方接受"));
        chatService.addSystemMessage(order.getChatId(), createText, String.valueOf(order.getPostId()), post.getTitle());

        try {
                    String noticeMsg = String.format("{\"type\":\"PERSONAL_NOTICE\",\"message\":\"有人向您的帖子『%s』发起了订单申请，请及时前往消息中心处理！\"}", post.getTitle());
                    com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(post.getPublisherId(), noticeMsg);
                } catch (Exception e) {
                    log.error("WebSocket实时通知发送失败", e);
                }

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

        try {
                    String takenMsg = String.format("{\"type\":\"TASK_TAKEN\",\"postId\":%d}", post.getId());
                    com.example.keshe_backend.common.websocket.NotificationWSServer.broadcast(takenMsg);

                    Long applicantId = order.getPayerId().equals(userId) ? order.getEarnerId() : order.getPayerId();
                    String pNotice = String.format("{\"type\":\"PERSONAL_NOTICE\",\"message\":\"您对任务『%s』的订单申请已被对方接受，任务正式开始执行！\"}", post.getTitle());
                    com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(applicantId, pNotice);
                } catch (Exception e) {
                    log.error("WebSocket实时通知发送失败", e);
                }

        // 系统消息：接受订单（+ 预付冻结）。接受方即发布者
        chatService.addSystemMessage(order.getChatId(), nameOf(userId) + " 接受了订单，任务开始执行", String.valueOf(order.getPostId()), post.getTitle());
        if (amount.compareTo(BigDecimal.ZERO) > 0) {
            chatService.addSystemMessage(order.getChatId(), nameOf(order.getPayerId()) + " 已预付报酬 " + fmt(amount) + " 元（已冻结）", String.valueOf(order.getPostId()), post.getTitle());
        }

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

        try {
                    Long partnerId = order.getPayerId().equals(userId) ? order.getEarnerId() : order.getPayerId();
                    String title = taskRepository.findById(order.getPostId()).map(Task::getTitle).orElse("未知任务");
                    String cancelMsg = String.format("{\"type\":\"PERSONAL_NOTICE\",\"message\":\"对方取消了关于任务『%s』的待接受订单。\"}", title);
                    com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(partnerId, cancelMsg);
                } catch (Exception e) {
                    log.error("WebSocket取消订单通知失败", e);
                }
        // 系统消息：取消订单
        String cancelTitle = taskRepository.findById(order.getPostId()).map(Task::getTitle).orElse("");
        chatService.addSystemMessage(order.getChatId(), nameOf(userId) + " 取消了订单", String.valueOf(order.getPostId()), cancelTitle);

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

        // 系统消息：确认方
        String cfTitle = taskRepository.findById(order.getPostId()).map(Task::getTitle).orElse("");
        chatService.addSystemMessage(order.getChatId(), nameOf(userId) + " 已确认完成", String.valueOf(order.getPostId()), cfTitle);

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
            // 系统消息：双方确认，结算
            chatService.addSystemMessage(order.getChatId(), order.getAmount().compareTo(BigDecimal.ZERO) > 0
                    ? ("双方已确认，报酬 " + fmt(order.getAmount()) + " 元已结算给 " + nameOf(order.getEarnerId()))
                    : "双方已确认，任务完成", String.valueOf(order.getPostId()), cfTitle);
        } else {
            // 单方确认：设置自动确认时间
            order.setAutoConfirmAt(now.plusDays(AUTO_DAYS));
        }

        orderRepository.save(order);

        try {
            if (Boolean.TRUE.equals(order.getPayerConfirmed()) && Boolean.TRUE.equals(order.getEarnerConfirmed())) {
                String finishMsg = String.format("{\"type\":\"PERSONAL_NOTICE\",\"message\":\"订单『%s』已双方确认完成，报酬已成功结算！\"}", cfTitle);
                com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(order.getPayerId(), finishMsg);
                com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(order.getEarnerId(), finishMsg);
            } else {
                Long partnerId = order.getPayerId().equals(userId) ? order.getEarnerId() : order.getPayerId();
                String remindMsg = String.format("{\"type\":\"PERSONAL_NOTICE\",\"message\":\"对方已确认完成任务『%s』，请您及时前往核对并确认完成。\"}", cfTitle);
                com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(partnerId, remindMsg);
            }
        } catch (Exception e) {
            log.error("WebSocket确认订单通知失败", e);
        }
        return OrderDTO.from(order);
    }

    /**
     * 发起申诉（付款方/收款方任一方、仅 in_progress）→ disputed。
     * 资金保持冻结（不退不结），等待管理员裁决；聊天发系统消息。
     */
    @Transactional
    public OrderDTO disputeOrder(Long orderId, String reason) {
        Long userId = SecurityUtils.getCurrentUserId();
        requireVerified(userId);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在"));
        if (!order.getPayerId().equals(userId) && !order.getEarnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "你不是该订单的参与者");
        }
        if (!"in_progress".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_ORDER_STATUS, "仅进行中的订单可以申诉");
        }
        String r = reason == null ? "" : reason.trim();
        if (r.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "请填写申诉理由");
        }

        order.setStatus("disputed");
        order.setDisputeReason(r);
        order.setDisputedBy(userId);
        order.setDisputedAt(LocalDateTime.now());
        orderRepository.save(order);

        // 1. 这里先定义并获取了 title 变量
        String title = taskRepository.findById(order.getPostId()).map(Task::getTitle).orElse("");
        chatService.addSystemMessage(order.getChatId(),
                nameOf(userId) + " 发起了申诉：" + r + "。订单已冻结，等待管理员处理",
                String.valueOf(order.getPostId()), title);

        // ======= 2. 新增的 WebSocket 通知代码（移到此处，此时 title 变量就已经存在了） =======
        try {
            Long partnerId = order.getPayerId().equals(userId) ? order.getEarnerId() : order.getPayerId();
            String disputeMsg = String.format("{\"type\":\"PERSONAL_NOTICE\",\"message\":\"对方针对订单『%s』发起了争议申诉，资金已被冻结，请等待管理员处理。\"}", title);
            com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(partnerId, disputeMsg);
        } catch (Exception e) {
            log.error("WebSocket争议通知失败", e);
        }
        // ==============================================================================

        return OrderDTO.from(order);
    }

    // ---------- 管理员（Controller 层由 /api/admin/** 的 ROLE_ADMIN 规则鉴权）----------

    private AdminOrderItemResponse toAdminItem(Order o) {
        String title = taskRepository.findById(o.getPostId()).map(Task::getTitle).orElse("");
        return AdminOrderItemResponse.builder()
                .order(OrderDTO.from(o))
                .postTitle(title)
                .payerName(nameOf(o.getPayerId()))
                .earnerName(nameOf(o.getEarnerId()))
                .disputedByName(o.getDisputedBy() != null ? nameOf(o.getDisputedBy()) : "")
                .build();
    }

    /** 待处理争议订单列表 */
    public List<AdminOrderItemResponse> adminListDisputes() {
        return orderRepository.findByStatusOrderByDisputedAtDesc("disputed")
                .stream().map(this::toAdminItem).collect(Collectors.toList());
    }

    /** 全部订单总览 */
    public List<AdminOrderItemResponse> adminListOrders() {
        return orderRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toAdminItem).collect(Collectors.toList());
    }

    /**
     * 管理员裁决争议订单（对齐 JS mock 的 mockResolveDispute）：
     * refund 全额退付款方 / settle 全额结算收款方 / partial 部分给收款方、其余退付款方。
     * 结案 → closed，按裁决转账并记账单流水，聊天发系统消息。closed 不进入评价流程。
     */
    @Transactional
    public OrderDTO resolveDispute(Long orderId, String decision, BigDecimal amountToEarner, String note) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在"));
        if (!"disputed".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_ORDER_STATUS, "该订单不在争议处理中");
        }
        String noteText = note == null ? "" : note.trim();
        if (noteText.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "请填写处理说明");
        }

        BigDecimal amount = order.getAmount() != null ? order.getAmount() : BigDecimal.ZERO;
        BigDecimal earnerGets;
        if ("refund".equals(decision)) {
            earnerGets = BigDecimal.ZERO;
        } else if ("settle".equals(decision)) {
            earnerGets = amount;
        } else if ("partial".equals(decision)) {
            if (amountToEarner == null || amountToEarner.compareTo(BigDecimal.ZERO) <= 0
                    || amountToEarner.compareTo(amount) >= 0) {
                throw new BusinessException(ErrorCode.PARAM_ERROR,
                        "部分结算金额需大于 0 且小于订单金额 " + fmt(amount) + " 元");
            }
            earnerGets = amountToEarner;
        } else {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "无效的处理方式");
        }
        BigDecimal payerGets = amount.subtract(earnerGets);

        String title = taskRepository.findById(order.getPostId()).map(Task::getTitle).orElse("");

        if (payerGets.compareTo(BigDecimal.ZERO) > 0) {
            User payer = userRepository.findById(order.getPayerId()).orElse(null);
            if (payer != null) {
                payer.setBalance(payer.getBalance().add(payerGets));
                userRepository.save(payer);
                Transaction tx = new Transaction();
                tx.setUserId(order.getPayerId());
                tx.setDirection("in");
                tx.setAmount(payerGets);
                tx.setCategory("order");
                tx.setRelatedId(order.getId().toString());
                tx.setNote("仲裁退款：" + title);
                transactionRepository.save(tx);
            }
        }
        if (earnerGets.compareTo(BigDecimal.ZERO) > 0) {
            User earner = userRepository.findById(order.getEarnerId()).orElse(null);
            if (earner != null) {
                earner.setBalance(earner.getBalance().add(earnerGets));
                userRepository.save(earner);
                Transaction tx = new Transaction();
                tx.setUserId(order.getEarnerId());
                tx.setDirection("in");
                tx.setAmount(earnerGets);
                tx.setCategory("order");
                tx.setRelatedId(order.getId().toString());
                tx.setNote("订单收入（仲裁）：" + title);
                transactionRepository.save(tx);
            }
        }

        order.setStatus("closed");
        order.setResolution(decision);
        order.setResolutionAmountToEarner(earnerGets);
        order.setResolutionNote(noteText);
        order.setResolvedAt(LocalDateTime.now());
        orderRepository.save(order);

        try {
                    String resolveMsg = String.format("{\"type\":\"PERSONAL_NOTICE\",\"message\":\"管理员已对您的争议订单『%s』做出最终裁决结案，请查看聊天记录详情。\"}", title);
                    com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(order.getPayerId(), resolveMsg);
                    com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(order.getEarnerId(), resolveMsg);
                } catch (Exception e) {
                    log.error("WebSocket仲裁通知失败", e);
                }
        String text;
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            text = "管理员已结案（说明：" + noteText + "）";
        } else if ("refund".equals(decision)) {
            text = "管理员已结案：全额退款，" + fmt(amount) + " 元已退还 " + nameOf(order.getPayerId()) + "（说明：" + noteText + "）";
        } else if ("settle".equals(decision)) {
            text = "管理员已结案：全额结算，" + fmt(amount) + " 元已支付给 " + nameOf(order.getEarnerId()) + "（说明：" + noteText + "）";
        } else {
            text = "管理员已结案：部分结算，" + nameOf(order.getEarnerId()) + " 获得 " + fmt(earnerGets) + " 元，"
                    + nameOf(order.getPayerId()) + " 获退 " + fmt(payerGets) + " 元（说明：" + noteText + "）";
        }
        chatService.addSystemMessage(order.getChatId(), text, String.valueOf(order.getPostId()), title);

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
