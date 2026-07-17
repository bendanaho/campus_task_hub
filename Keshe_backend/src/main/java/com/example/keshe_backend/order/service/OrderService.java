package com.example.keshe_backend.order.service;

import static com.example.keshe_backend.transaction.service.WalletService.relOrder;
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
import com.example.keshe_backend.review.repository.ReviewRepository;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.transaction.entity.Transaction;
import com.example.keshe_backend.transaction.repository.TransactionRepository;
import com.example.keshe_backend.transaction.service.WalletService;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final int AUTO_DAYS = 2;

    /**
     * "活跃"订单状态：钱还托管着、事情没了结。这三种状态下不允许再下新单。
     * 终态(cancelled/completed/closed)都应允许重新下单——与前端任务栏同口径，
     * 前端 ACTIVE_ORDER_STATUSES 必须与此保持一致。
     */
    private static final List<String> ACTIVE_ORDER_STATUSES =
            Arrays.asList("pending", "in_progress", "disputed");

    private final OrderRepository orderRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final WalletService walletService;
    private final ReviewRepository reviewRepository;
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

        // 悬赏帖(payer)：一个悬赏只会被一个人接，故按【帖子】限制同时只能有一笔活跃订单
        if ("payer".equals(post.getPublisherSide())) {
            List<Order> active = orderRepository.findByPostIdAndStatusIn(
                    request.getPostId(), ACTIVE_ORDER_STATUSES);
            if (!active.isEmpty()) {
                throw new BusinessException(ErrorCode.DUPLICATE_ORDER);
            }
        } else {
            // 服务帖(earner)/组队帖(none)：一个帖子可同时服务多个买家，不能按帖子限制，
            // 但【同一会话】(同一对用户在同一任务下)同时只能有一笔活跃订单。
            // 此前这里完全没有守卫：同一个买家能对同一服务连下多单，每笔都会各自冻结一次钱，
            // 而聊天页/消息中心只认最新一笔(findTopByChatIdOrderByCreatedAtDesc)，
            // 早先那些订单在聊天里根本看不见 → 无法确认/申诉 → 付款方的钱永久冻结。
            List<Order> activeInChat = orderRepository.findByChatIdAndStatusIn(
                    request.getChatId(), ACTIVE_ORDER_STATUSES);
            if (!activeInChat.isEmpty()) {
                throw new BusinessException(ErrorCode.DUPLICATE_ORDER,
                        "你与对方在该任务下已有进行中的订单，请先完成或取消它再下新单");
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

        // 先给出友好提示（hold 自身只会抛通用的"余额不足"）
        if (payerId.equals(userId) && amount.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal bal = currentUser.getBalance() == null ? BigDecimal.ZERO : currentUser.getBalance();
            if (bal.compareTo(amount) < 0) {
                throw new BusinessException(ErrorCode.BALANCE_NOT_ENOUGH, "余额不足，无法下单，请先充值");
            }
        }

        Order order = new Order();
        order.setChatId(request.getChatId());
        order.setPostId(request.getPostId());
        order.setPayerId(payerId);
        order.setEarnerId(earnerId);
        order.setAmount(amount);
        order.setStatus("pending");
        order = orderRepository.save(order);

        // 【下单即冻结】服务帖(earner)/组队帖的下单者就是付款方，钱在这一刻预留住。
        // 此前是等对方接受时才 hold：只"校验余额"挡不住——校验到真正扣款之间(等待对方接受的
        // 整段时间)这笔钱仍可被花掉，等对方点接受时 hold 失败，错误还暴露在【对方】那侧。
        // 悬赏帖(payer)的报酬已在【发布时】冻结、下单者是收款方，这里不冻。
        // 整个方法在事务里，hold 失败会连订单一起回滚。
        if (payerId.equals(userId) && amount.compareTo(BigDecimal.ZERO) > 0) {
            walletService.hold(userId, amount, "escrow_freeze", relOrder(order.getId()),
                    "下单冻结报酬：" + post.getTitle());
        }

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

        // 这里不再冻结：报酬要么在【发布时】冻(悬赏帖)、要么在【下单时】冻(服务帖/组队帖)，
        // 到接单这一步钱已经预留好了。此前在这里 hold 会让"等待接受"期间的钱处于未预留状态。

        order.setStatus("in_progress");
        order.setAcceptedAt(now);

        // 悬赏帖（payer）：关闭帖子
        if ("payer".equals(post.getPublisherSide())) {
            post.setStatus("closed");
            taskRepository.save(post);
        }

        orderRepository.save(order);

        try {
                    // TASK_TAKEN 只对悬赏帖（payer，被接即 closed）广播：服务帖可复用，被接不影响他人，无需让大厅移除
                    if ("payer".equals(post.getPublisherSide())) {
                        String takenMsg = String.format("{\"type\":\"TASK_TAKEN\",\"postId\":%d}", post.getId());
                        com.example.keshe_backend.common.websocket.NotificationWSServer.broadcast(takenMsg);
                    }

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

        // 下单时冻结的钱要退回付款方（对方拒绝、或自己撤回，都走这里）。
        Task cancelPost = taskRepository.findById(order.getPostId()).orElse(null);
        refundOrderEscrowIfAny(order, cancelPost);

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

            // 结算给收款方：释放冻结的报酬（付款方 frozen → 收款方 balance）
            BigDecimal amount = order.getAmount();
            if (amount.compareTo(BigDecimal.ZERO) > 0) {
                Task post = taskRepository.findById(order.getPostId()).orElse(null);
                walletService.release(order.getPayerId(), order.getEarnerId(), amount, "order",
                        relOrder(order.getId()), "订单收入：" + (post != null ? post.getTitle() : ""));
            }
            // 释放该会话托管中的私信转账给各自接收方
            chatService.releaseEscrowedTransfers(order.getChatId());
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
        BigDecimal amount = o.getAmount() != null ? o.getAmount() : BigDecimal.ZERO;
        // 只有争议单需要知道托管转账明细，其余订单不必为此多查一次会话消息
        BigDecimal escrowed = "disputed".equals(o.getStatus())
                ? chatService.sumEscrowedTransfers(o.getChatId())
                : BigDecimal.ZERO;
        return AdminOrderItemResponse.builder()
                .order(OrderDTO.from(o))
                .postTitle(title)
                .payerName(nameOf(o.getPayerId()))
                .earnerName(nameOf(o.getEarnerId()))
                .disputedByName(o.getDisputedBy() != null ? nameOf(o.getDisputedBy()) : "")
                .escrowedTransferTotal(escrowed)
                .disputeTotal(amount.add(escrowed))
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

        // 争议标的 = 订单金额 + 该会话仍在托管中的私信转账。
        // 此前只按 order.amount 分配，托管转账则"全有或全无"地跟着 decision 走：
        //   - 全额退款/结算：净额碰巧对（20+5 都给同一方），看不出问题
        //   - 部分结算：管理员以为在分 20，那 5 元转账却被全额悄悄划给收款方，
        //     而且面板压根没告诉他这 5 元存在（上限也被卡在 20，退不了 25）
        // 现在按总额统一分配：钱包的 frozen 不区分是哪一笔冻的，一次性分完即可。
        BigDecimal amount = order.getAmount() != null ? order.getAmount() : BigDecimal.ZERO;
        BigDecimal escrowedTransfers = chatService.sumEscrowedTransfers(order.getChatId());
        BigDecimal total = amount.add(escrowedTransfers);

        BigDecimal earnerGets;
        if ("refund".equals(decision)) {
            earnerGets = BigDecimal.ZERO;
        } else if ("settle".equals(decision)) {
            earnerGets = total;
        } else if ("partial".equals(decision)) {
            if (amountToEarner == null || amountToEarner.compareTo(BigDecimal.ZERO) <= 0
                    || amountToEarner.compareTo(total) >= 0) {
                throw new BusinessException(ErrorCode.PARAM_ERROR,
                        "部分结算金额需大于 0 且小于争议总额 " + fmt(total) + " 元"
                                + (escrowedTransfers.compareTo(BigDecimal.ZERO) > 0
                                    ? "（订单 " + fmt(amount) + " + 托管转账 " + fmt(escrowedTransfers) + "）" : ""));
            }
            earnerGets = amountToEarner;
        } else {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "无效的处理方式");
        }
        BigDecimal payerGets = total.subtract(earnerGets);

        String title = taskRepository.findById(order.getPostId()).map(Task::getTitle).orElse("");

        // 从付款方冻结中分配：退回付款方 payerGets、结算给收款方 earnerGets
        if (payerGets.compareTo(BigDecimal.ZERO) > 0) {
            walletService.refund(order.getPayerId(), payerGets, "escrow_refund",
                    relOrder(order.getId()), "仲裁退款：" + title);
        }
        if (earnerGets.compareTo(BigDecimal.ZERO) > 0) {
            walletService.release(order.getPayerId(), order.getEarnerId(), earnerGets, "order",
                    relOrder(order.getId()), "订单收入（仲裁）：" + title);
        }
        // 托管转账的钱已包含在上面的总额里分完了，这里只标记状态，不能再动钱（否则重复扣款）
        chatService.markEscrowedTransfersArbitrated(order.getChatId());

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
     * 我的订单（支持按关键词检索 + 状态筛选）
     */
    public List<MyOrderResponse> getMyOrders(String role, String keyword, String status) {
        Long userId = SecurityUtils.getCurrentUserId();

        List<Order> orders;
        if ("payer".equals(role)) {
            orders = orderRepository.findByPayerIdOrderByCreatedAtDesc(userId);
        } else if ("earner".equals(role)) {
            orders = orderRepository.findByEarnerIdOrderByCreatedAtDesc(userId);
        } else {
            orders = orderRepository.findByPayerIdOrEarnerIdOrderByCreatedAtDesc(userId, userId);
        }

        // 关键词归一化（null/空视为不筛选）；状态筛选（"all" 或空视为不筛选）
        String kw = keyword == null ? "" : keyword.trim().toLowerCase();
        boolean filterStatus = status != null && !status.isBlank() && !"all".equals(status);

        // 先按状态过滤，再批量预取帖子与对方用户——原先是逐单 findById(post)+findById(partner)
        // 的 1+2N；现固定为 3 次查询。
        List<Order> candidates = filterStatus
                ? orders.stream().filter(o -> status.equals(o.getStatus())).collect(Collectors.toList())
                : orders;
        if (candidates.isEmpty()) return new ArrayList<>();

        Set<Long> postIds = candidates.stream().map(Order::getPostId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, Task> postById = new HashMap<>();
        if (!postIds.isEmpty()) for (Task t : taskRepository.findAllById(postIds)) postById.put(t.getId(), t);

        Set<Long> partnerIds = candidates.stream()
                .map(o -> o.getPayerId().equals(userId) ? o.getEarnerId() : o.getPayerId())
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, User> userById = new HashMap<>();
        if (!partnerIds.isEmpty()) for (User u : userRepository.findAllById(partnerIds)) userById.put(u.getId(), u);

        // 批量算"我已评价过哪些订单"，省掉前端逐单请求 /reviews/has-reviewed
        List<Long> completedIds = candidates.stream()
                .filter(o -> "completed".equals(o.getStatus()))
                .map(Order::getId).collect(Collectors.toList());
        Set<Long> reviewedIds = completedIds.isEmpty()
                ? new HashSet<>()
                : new HashSet<>(reviewRepository.findReviewedOrderIds(userId, completedIds));

        List<MyOrderResponse> result = new ArrayList<>();
        for (Order order : candidates) {
            Task post = postById.get(order.getPostId());
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

            User partner = userById.get(partnerId);
            partnerName = partner != null ? partner.getUsername() : "";
            String title = post != null ? post.getTitle() : "";

            // 关键词过滤：命中标题 / 对方用户名 / 订单号任一即可
            if (!kw.isEmpty()) {
                boolean hit = title.toLowerCase().contains(kw)
                        || partnerName.toLowerCase().contains(kw)
                        || String.valueOf(order.getId()).contains(kw);
                if (!hit) continue;
            }

            result.add(MyOrderResponse.builder()
                    .order(OrderDTO.from(order))
                    // fromLite：订单列表只需缩略图，原图点开详情再按需取（与大厅口径一致）
                    .post(post != null ? PostDTO.fromLite(post) : null)
                    .title(title)
                    .myRole(myRole)
                    .partnerId(partnerId)
                    .partnerName(partnerName)
                    .reviewed(reviewedIds.contains(order.getId()))
                    .build());
        }
        return result;
    }

    /**
     * 取消一笔尚未完成的订单时，退回它冻结的钱。
     *
     * 冻结归属分两种，退款规则随之不同：
     *  - 悬赏帖(payer)：报酬冻在【帖子】上（发布时冻结）。订单取消不退——帖子还挂着，
     *    等下一个人来接；真正退回发生在发布者撤回/管理员下架该帖时。
     *  - 服务帖(earner)/组队帖：冻在【订单】上（下单时冻结）。订单一取消就必须退给付款方，
     *    否则钱会一直冻着、没有任何东西能把它释放出来。
     */
    public void refundOrderEscrowIfAny(Order order, Task post) {
        if (post != null && "payer".equals(post.getPublisherSide())) return;
        BigDecimal amount = order.getAmount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        walletService.refund(order.getPayerId(), amount, "escrow_refund", relOrder(order.getId()),
                "订单取消，退回冻结报酬：" + (post != null ? post.getTitle() : ""));
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
