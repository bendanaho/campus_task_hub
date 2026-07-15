package com.example.keshe_backend.chat.service;

import com.example.keshe_backend.chat.dto.*;
import com.example.keshe_backend.chat.entity.Conversation;
import com.example.keshe_backend.chat.entity.Message;
import com.example.keshe_backend.chat.repository.ConversationRepository;
import com.example.keshe_backend.chat.repository.MessageRepository;
import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.order.entity.Order;
import com.example.keshe_backend.order.repository.OrderRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final OrderRepository orderRepository;
    private final TaskRepository taskRepository;
    private final ReviewRepository reviewRepository;
    private final WalletService walletService;

    public List<ConversationDTO> getConversations() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<Conversation> conversations = conversationRepository
                .findByUser1IdOrUser2IdOrderByLastTimeDesc(userId, userId);
        return conversations.stream()
                .map(c -> toConversationDTO(c, userId))
                .collect(Collectors.toList());
    }

    /**
     * 消息中心聚合：一次返回每个会话渲染所需的原始数据（会话 + 任务/订单快照 + 是否已评价 + 未读 + 发送者名），
     * 替代前端逐会话 N+1 请求。查询在服务端本地库完成，前端只需一次 HTTP。
     */
    public List<EnrichedConversationDTO> getEnrichedConversations() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<Conversation> conversations = conversationRepository
                .findByUser1IdOrUser2IdOrderByLastTimeDesc(userId, userId);
        List<EnrichedConversationDTO> result = new ArrayList<>();
        for (Conversation c : conversations) {
            ConversationDTO convDto = toConversationDTO(c, userId);
            long unread = messageRepository.countUnreadByChatIdAndUserId(c.getId(), userId);
            EnrichedConversationDTO.EnrichedConversationDTOBuilder b = EnrichedConversationDTO.builder()
                    .conversation(convDto)
                    .unread(unread);

            // 系统通知会话：无任务/订单，直接返回
            if (c.getId() != null && c.getId().startsWith("sys-notify-")) {
                result.add(b.build());
                continue;
            }

            // 最后一条消息发送者名（用于预览；1对1会话里对方即发送者）
            Long lastSender = c.getLastMessageSenderId();
            if (lastSender != null && lastSender > 0 && !lastSender.equals(userId)) {
                b.lastSenderName(convDto.getPartnerName());
            }

            // 任务快照
            if (c.getTaskId() != null) {
                Task task = taskRepository.findById(c.getTaskId()).orElse(null);
                if (task != null) {
                    b.taskPublisherId(task.getPublisherId());
                    b.taskPublisherSide(task.getPublisherSide());
                }
            }

            // 订单快照 + 是否已评价
            Order order = orderRepository.findTopByChatIdOrderByCreatedAtDesc(c.getId()).orElse(null);
            if (order != null) {
                b.order(EnrichedConversationDTO.OrderSnapshot.builder()
                        .id(order.getId())
                        .status(order.getStatus())
                        .payerId(order.getPayerId())
                        .earnerId(order.getEarnerId())
                        .payerConfirmed(order.getPayerConfirmed())
                        .earnerConfirmed(order.getEarnerConfirmed())
                        .build());
                if ("completed".equals(order.getStatus())) {
                    b.reviewed(reviewRepository.existsByOrderIdAndFromUserId(order.getId(), userId));
                }
            }
            result.add(b.build());
        }
        return result;
    }

    /**
     * 判断"待我操作"：待我接受(pending 且我是发布者) 或 待我确认(in_progress 且对方已确认、我未确认)。
     * 与前端 describeOrderStatus 的 action:true 分支保持一致，用于未读口径把待操作计入总数。
     */
    private boolean userNeedsAction(Order order, Long userId, Long taskPublisherId) {
        if (order == null) return false;
        String st = order.getStatus();
        boolean isPublisher = taskPublisherId != null && taskPublisherId.equals(userId);
        if ("pending".equals(st)) {
            return isPublisher; // 待我接受
        }
        if ("in_progress".equals(st)) {
            boolean isPayer = userId.equals(order.getPayerId());
            boolean myConfirmed = isPayer ? Boolean.TRUE.equals(order.getPayerConfirmed())
                                          : Boolean.TRUE.equals(order.getEarnerConfirmed());
            boolean otherConfirmed = isPayer ? Boolean.TRUE.equals(order.getEarnerConfirmed())
                                             : Boolean.TRUE.equals(order.getPayerConfirmed());
            return otherConfirmed && !myConfirmed; // 待我确认
        }
        return false;
    }

    private ConversationDTO toConversationDTO(Conversation c, Long currentUserId) {
        // 系统通知会话：对方固定为「系统通知」，不去查真实用户
        if (c.getId() != null && c.getId().startsWith("sys-notify-")) {
            return ConversationDTO.builder()
                    .id(c.getId())
                    .partnerId(0L)
                    .partnerName("系统通知")
                    .partnerAvatar("")
                    .taskId(null)
                    .taskTitle("系统通知")
                    .lastMessage(c.getLastMessage())
                    .lastTime(c.getLastTime())
                    .lastMessageSenderId(0L)
                    .build();
        }
        Long partnerId = c.getUser1Id().equals(currentUserId) ? c.getUser2Id() : c.getUser1Id();
        User partner = userRepository.findById(partnerId).orElse(null);
        return ConversationDTO.builder()
                .id(c.getId())
                .partnerId(partnerId)
                .partnerName(partner != null ? partner.getUsername() : "")
                .partnerAvatar(partner != null ? partner.getAvatar() : "")
                .taskId(c.getTaskId())
                .taskTitle(c.getTaskTitle())
                .lastMessage(c.getLastMessage())
                .lastTime(c.getLastTime())
                .lastMessageSenderId(c.getLastMessageSenderId())
                .build();
    }

    @Transactional
    public void ensureConversation(EnsureConversationRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        if (conversationRepository.existsById(request.getChatId())) {
            return;
        }
        Conversation c = new Conversation();
        c.setId(request.getChatId());
        c.setUser1Id(userId);
        c.setUser2Id(request.getPartnerId());
        c.setTaskId(request.getTaskId());
        c.setTaskTitle(request.getTaskTitle() != null ? request.getTaskTitle() : "");
        conversationRepository.save(c);
    }

    public List<MessageDTO> getMessages(String chatId) {
        Long userId = SecurityUtils.getCurrentUserId();
        // 管理员（role=1）可只读查看任意会话消息，作为争议仲裁的取证依据；普通用户仍须是参与者
        boolean isAdmin = userRepository.findById(userId)
                .map(u -> u.getRole() != null && u.getRole() == 1)
                .orElse(false);
        if (!isAdmin) {
            requireParticipant(chatId, userId);
        }
        return messageRepository.findByChatIdOrderByTimeAsc(chatId)
                .stream().map(MessageDTO::from).collect(Collectors.toList());
    }

    @Transactional
    public MessageDTO sendMessage(String chatId, String content) {
        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
        Conversation conv = requireParticipant(chatId, userId);
        Long receiverId = conv.getUser1Id().equals(userId) ? conv.getUser2Id() : conv.getUser1Id();
        LocalDateTime now = LocalDateTime.now();

        Message msg = new Message();
        msg.setChatId(chatId);
        msg.setSenderId(userId);
        msg.setSenderName(user.getUsername());
        msg.setReceiverId(receiverId);
        msg.setContent(content);
        msg.setType("text");
        msg.setTime(now);
        msg.setTaskId(conv.getTaskId() != null ? conv.getTaskId().toString() : "");
        msg.setTaskTitle(conv.getTaskTitle());
        msg = messageRepository.save(msg);

        conv.setLastMessage(content);
        conv.setLastTime(now);
        conv.setLastMessageSenderId(userId);
        conversationRepository.save(conv);

        // 通知会话另一方实时刷新聊天页（不推给自己）
        try {
            com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(
                    receiverId, "{\"type\":\"CHAT_UPDATE\",\"chatId\":\"" + chatId + "\"}");
        } catch (Exception e) {
            log.warn("WebSocket CHAT_UPDATE 推送失败 chatId={}", chatId, e);
        }
        return MessageDTO.from(msg);
    }

    // 保证同一操作连发多条系统消息时时间严格递增，避免同刻并列导致顺序不定
    private static final Object SYS_TIME_LOCK = new Object();
    private static LocalDateTime lastSystemTime = LocalDateTime.MIN;

    /**
     * 供订单/评价等业务在状态变更时向会话插入一条系统消息：
     * senderId=null、type="system"，前端居中显示；未读查询已用 senderId IS NOT NULL 排除，故不计未读。
     * 同步更新会话预览（lastMessage/lastTime），使消息中心显示最新进展。
     */
    @Transactional
    public void addSystemMessage(String chatId, String content, String taskId, String taskTitle) {
        if (chatId == null || chatId.isBlank()) return;
        LocalDateTime t;
        synchronized (SYS_TIME_LOCK) {
            t = LocalDateTime.now();
            if (!t.isAfter(lastSystemTime)) t = lastSystemTime.plusNanos(1_000_000);
            lastSystemTime = t;
        }
        final LocalDateTime now = t; // lambda 需要 final

        Message msg = new Message();
        msg.setChatId(chatId);
        msg.setSenderId(null);
        msg.setSenderName("系统");
        msg.setReceiverId(null);
        msg.setContent(content);
        msg.setType("system");
        msg.setTime(now);
        msg.setTaskId(taskId != null ? taskId : "");
        msg.setTaskTitle(taskTitle != null ? taskTitle : "");
        msg.setWithdrawn(false);
        msg.setRead(true);
        messageRepository.save(msg);

        conversationRepository.findById(chatId).ifPresent(conv -> {
            conv.setLastMessage(content);
            conv.setLastTime(now);
            conv.setLastMessageSenderId(null);
            conversationRepository.save(conv);

            // 通知会话双方实时刷新聊天页（订单状态变更的系统消息）
            String updateMsg = "{\"type\":\"CHAT_UPDATE\",\"chatId\":\"" + chatId + "\"}";
            try {
                if (conv.getUser1Id() != null) {
                    com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(conv.getUser1Id(), updateMsg);
                }
                if (conv.getUser2Id() != null) {
                    com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(conv.getUser2Id(), updateMsg);
                }
            } catch (Exception e) {
                log.warn("WebSocket CHAT_UPDATE 推送失败 chatId={}", chatId, e);
            }
        });
    }

    /**
     * 系统通知（平台 → 单个用户），挂在该用户专属会话 sys-notify-&lt;userId&gt;。
     * 与订单里的系统消息(senderId=null)区别：这里 senderId=0（非 null → 计入未读；
     * 无对应真实用户），type="system"（聊天里居中显示）。用于帖子下架/删除等平台通知。
     */
    @Transactional
    public void addSystemNotify(Long userId, String content) {
        if (userId == null) return;
        String chatId = "sys-notify-" + userId;
        LocalDateTime t;
        synchronized (SYS_TIME_LOCK) {
            t = LocalDateTime.now();
            if (!t.isAfter(lastSystemTime)) t = lastSystemTime.plusNanos(1_000_000);
            lastSystemTime = t;
        }
        final LocalDateTime now = t;

        Conversation conv = conversationRepository.findById(chatId).orElse(null);
        if (conv == null) {
            conv = new Conversation();
            conv.setId(chatId);
            conv.setUser1Id(userId);
            conv.setUser2Id(0L);        // 哨兵：系统通知无真实对方
            conv.setTaskTitle("系统通知");
        }
        conv.setLastMessage(content);
        conv.setLastTime(now);
        conv.setLastMessageSenderId(0L);
        conversationRepository.save(conv);

        Message msg = new Message();
        msg.setChatId(chatId);
        msg.setSenderId(0L);            // 非 null → 计入未读；0 无对应真实用户
        msg.setSenderName("系统通知");
        msg.setReceiverId(userId);
        msg.setContent(content);
        msg.setType("system");
        msg.setTime(now);
        msg.setTaskId("");
        msg.setTaskTitle("");
        msg.setWithdrawn(false);
        msg.setRead(false);
        messageRepository.save(msg);
    }

    @Transactional
    public int markMessagesRead(String chatId) {
        Long userId = SecurityUtils.getCurrentUserId();
        requireParticipant(chatId, userId);
        return messageRepository.markMessagesRead(chatId, userId);
    }

    @Transactional
    public MessageDTO sendPaymentCard(String chatId, SendPaymentRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        User currentUser = requireVerified(userId);
        // 管理员为纯管理角色，不参与交易/收付款
        if (currentUser.getRole() != null && currentUser.getRole() == 1) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "管理员账号不参与交易");
        }
        requireParticipant(chatId, userId);
        User partner = userRepository.findById(request.getPartnerId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "对方不存在"));
        if (request.getPartnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "不能给自己付款");
        }
        BigDecimal amount = request.getAmount();
        String kind = request.getKind();
        if (!"request".equals(kind) && !"transfer".equals(kind)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "kind 必须为 request 或 transfer");
        }

        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> payment = new LinkedHashMap<>();
        payment.put("kind", kind);
        payment.put("amount", amount);

        if ("transfer".equals(kind)) {
            if (currentUser.getBalance().compareTo(amount) < 0) {
                throw new BusinessException(ErrorCode.BALANCE_NOT_ENOUGH);
            }
            // 该会话若存在进行中订单 → 转账托管(冻结至订单完成)，否则即时到账
            Order activeOrder = orderRepository.findTopByChatIdOrderByCreatedAtDesc(chatId).orElse(null);
            boolean escrow = activeOrder != null && "in_progress".equals(activeOrder.getStatus());

            payment.put("payerId", userId);
            payment.put("payerName", currentUser.getUsername());
            payment.put("receiverId", partner.getId());
            payment.put("receiverName", partner.getUsername());

            if (escrow) {
                // 冻结发送方：balance → frozen，待订单完成释放给对方 / 取消退回
                walletService.hold(userId, amount, "escrow_transfer", activeOrder.getId().toString(),
                        "转账托管给 " + partner.getUsername());
                payment.put("status", "escrowed");
                payment.put("orderId", activeOrder.getId());
            } else {
                currentUser.setBalance(currentUser.getBalance().subtract(amount));
                partner.setBalance(partner.getBalance().add(amount));
                userRepository.save(currentUser);
                userRepository.save(partner);

                Transaction txOut = new Transaction();
                txOut.setUserId(userId);
                txOut.setDirection("out");
                txOut.setAmount(amount);
                txOut.setCategory("payment");
                txOut.setNote("转账给 " + partner.getUsername());
                transactionRepository.save(txOut);

                Transaction txIn = new Transaction();
                txIn.setUserId(partner.getId());
                txIn.setDirection("in");
                txIn.setAmount(amount);
                txIn.setCategory("payment");
                txIn.setNote(currentUser.getUsername() + " 的转账");
                transactionRepository.save(txIn);

                payment.put("status", "paid");
                payment.put("paidAt", now.toString());
            }
        } else {
            payment.put("status", "pending");
            payment.put("payerId", partner.getId());
            payment.put("payerName", partner.getUsername());
            payment.put("receiverId", userId);
            payment.put("receiverName", currentUser.getUsername());
            payment.put("paidAt", null);
        }

        String paymentJson = toJson(payment);
        String content = "request".equals(kind)
                ? "收款 ¥" + amount + "（等待付款）"
                : "转账 ¥" + amount;

        Message msg = new Message();
        msg.setChatId(chatId);
        msg.setSenderId(userId);
        msg.setSenderName(currentUser.getUsername());
        msg.setReceiverId(request.getPartnerId());
        msg.setContent(content);
        msg.setType("payment");
        msg.setTime(now);
        msg.setPayment(paymentJson);
        msg = messageRepository.save(msg);

        Conversation conv = conversationRepository.findById(chatId).orElse(null);
        if (conv != null) {
            conv.setLastMessage(content);
            conv.setLastTime(now);
            conv.setLastMessageSenderId(userId);
            conversationRepository.save(conv);
        }

        // 通知对方实时刷新聊天页（收款/转账卡片状态变更）
        try {
            com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(
                    request.getPartnerId(), "{\"type\":\"CHAT_UPDATE\",\"chatId\":\"" + chatId + "\"}");
        } catch (Exception e) {
            log.warn("WebSocket CHAT_UPDATE 推送失败 chatId={}", chatId, e);
        }
        return MessageDTO.from(msg);
    }

    @Transactional
    public MessageDTO payPaymentCard(Long messageId) {
        Long userId = SecurityUtils.getCurrentUserId();
        User currentUser = requireVerified(userId);
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "消息不存在"));
        if (!"payment".equals(msg.getType())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "不是付款消息");
        }
        Map<String, Object> payment = parseJson(msg.getPayment());
        if (payment == null) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "付款信息不存在");
        }
        if (!"pending".equals(payment.get("status"))) {
            throw new BusinessException(ErrorCode.PAYMENT_ALREADY_PROCESSED);
        }
        Long payerId = toLong(payment.get("payerId"));
        if (!payerId.equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有付款方才能支付");
        }
        BigDecimal amount = toBigDecimal(payment.get("amount"));
        Long receiverId = toLong(payment.get("receiverId"));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "收款方不存在"));
        if (currentUser.getBalance().compareTo(amount) < 0) {
            throw new BusinessException(ErrorCode.BALANCE_NOT_ENOUGH);
        }

        LocalDateTime now = LocalDateTime.now();
        currentUser.setBalance(currentUser.getBalance().subtract(amount));
        receiver.setBalance(receiver.getBalance().add(amount));
        userRepository.save(currentUser);
        userRepository.save(receiver);

        Transaction txOut = new Transaction();
        txOut.setUserId(userId);
        txOut.setDirection("out");
        txOut.setAmount(amount);
        txOut.setCategory("payment");
        txOut.setRelatedId(messageId.toString());
        txOut.setNote("支付给 " + receiver.getUsername());
        transactionRepository.save(txOut);

        Transaction txIn = new Transaction();
        txIn.setUserId(receiverId);
        txIn.setDirection("in");
        txIn.setAmount(amount);
        txIn.setCategory("payment");
        txIn.setRelatedId(messageId.toString());
        txIn.setNote(currentUser.getUsername() + " 的支付");
        transactionRepository.save(txIn);

        payment.put("status", "paid");
        payment.put("paidAt", now.toString());
        msg.setPayment(toJson(payment));
        msg = messageRepository.save(msg);

        // 通知收款方实时刷新聊天页（卡片变已支付）
        try {
            com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(
                    receiverId, "{\"type\":\"CHAT_UPDATE\",\"chatId\":\"" + msg.getChatId() + "\"}");
        } catch (Exception e) {
            log.warn("WebSocket CHAT_UPDATE 推送失败 chatId={}", msg.getChatId(), e);
        }
        return MessageDTO.from(msg);
    }

    @Transactional
    public MessageDTO cancelPaymentCard(Long messageId) {
        Long userId = SecurityUtils.getCurrentUserId();
        requireVerified(userId);
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "消息不存在"));
        if (!"payment".equals(msg.getType())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "不是付款消息");
        }
        Map<String, Object> payment = parseJson(msg.getPayment());
        if (payment == null || !"pending".equals(payment.get("status"))) {
            throw new BusinessException(ErrorCode.PAYMENT_ALREADY_PROCESSED);
        }
        if (!msg.getSenderId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有发送者才能取消");
        }
        payment.put("status", "cancelled");
        msg.setPayment(toJson(payment));
        msg = messageRepository.save(msg);

        // 通知付款方实时刷新聊天页（卡片被取消）
        try {
            Long payerId = toLong(payment.get("payerId"));
            com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(
                    payerId, "{\"type\":\"CHAT_UPDATE\",\"chatId\":\"" + msg.getChatId() + "\"}");
        } catch (Exception e) {
            log.warn("WebSocket CHAT_UPDATE 推送失败 chatId={}", msg.getChatId(), e);
        }
        return MessageDTO.from(msg);
    }

    @Transactional
    public MessageDTO withdrawMessage(Long messageId) {
        Long userId = SecurityUtils.getCurrentUserId();
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "消息不存在"));
        if (!msg.getSenderId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        long secondsSince = ChronoUnit.SECONDS.between(msg.getTime(), LocalDateTime.now());
        if (secondsSince > 120) {
            throw new BusinessException(ErrorCode.WITHDRAW_TIMEOUT);
        }
        msg.setWithdrawn(true);
        msg.setContent("消息已撤回");
        msg = messageRepository.save(msg);
        return MessageDTO.from(msg);
    }

    public UnreadCountResponse getUnreadCounts() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<Conversation> conversations = conversationRepository
                .findByUser1IdOrUser2IdOrderByLastTimeDesc(userId, userId);
        Map<String, Long> byChat = new LinkedHashMap<>();
        long total = 0;
        long actionCount = 0;
        for (Conversation c : conversations) {
            long count = messageRepository.countUnreadByChatIdAndUserId(c.getId(), userId);
            if (count > 0) {
                byChat.put(c.getId(), count);
                total += count;
            }
            // #4：待操作(待我接受/待我确认)也计入未读总数——即便该会话没有未读消息
            if (c.getTaskId() != null && (c.getId() == null || !c.getId().startsWith("sys-notify-"))) {
                Order order = orderRepository.findTopByChatIdOrderByCreatedAtDesc(c.getId()).orElse(null);
                if (order != null) {
                    Task task = taskRepository.findById(c.getTaskId()).orElse(null);
                    Long pubId = task != null ? task.getPublisherId() : null;
                    if (userNeedsAction(order, userId, pubId)) {
                        actionCount++;
                    }
                }
            }
        }
        total += actionCount;
        return UnreadCountResponse.builder().total(total).byChat(byChat).build();
    }

    /**
     * 释放该会话所有"托管中"(escrowed)的转账给各自接收方（订单完成/结算时调用）。
     */
    @Transactional
    public void releaseEscrowedTransfers(String chatId) {
        List<Message> msgs = messageRepository.findByChatIdOrderByTimeAsc(chatId);
        for (Message m : msgs) {
            if (!"payment".equals(m.getType())) continue;
            Map<String, Object> p = parseJson(m.getPayment());
            if (p == null || !"escrowed".equals(p.get("status"))) continue;
            Long payerId = toLong(p.get("payerId"));
            Long receiverId = toLong(p.get("receiverId"));
            BigDecimal amt = new BigDecimal(String.valueOf(p.get("amount")));
            walletService.release(payerId, receiverId, amt, "payment", m.getId().toString(), "转账到账（订单完成）");
            p.put("status", "released");
            m.setPayment(toJson(p));
            messageRepository.save(m);
        }
    }

    /**
     * 退回该会话所有"托管中"(escrowed)的转账给各自发送方（订单取消/全额退款时调用）。
     */
    @Transactional
    public void refundEscrowedTransfers(String chatId) {
        List<Message> msgs = messageRepository.findByChatIdOrderByTimeAsc(chatId);
        for (Message m : msgs) {
            if (!"payment".equals(m.getType())) continue;
            Map<String, Object> p = parseJson(m.getPayment());
            if (p == null || !"escrowed".equals(p.get("status"))) continue;
            Long payerId = toLong(p.get("payerId"));
            BigDecimal amt = new BigDecimal(String.valueOf(p.get("amount")));
            walletService.refund(payerId, amt, "escrow_refund", m.getId().toString(), "转账退回（订单未成）");
            p.put("status", "refunded");
            m.setPayment(toJson(p));
            messageRepository.save(m);
        }
    }

    // ===== 辅助 =====

    private User requireVerified(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
        if (user.getAuthStatus() == null || user.getAuthStatus() != 1) {
            throw new BusinessException(ErrorCode.VERIFICATION_REQUIRED);
        }
        return user;
    }

    /**
     * 验证当前用户是会话参与者，不是则抛出 FORBIDDEN。
     */
    private Conversation requireParticipant(String chatId, Long userId) {
        Conversation conv = conversationRepository.findById(chatId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "会话不存在"));
        if (!conv.getUser1Id().equals(userId) && !conv.getUser2Id().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "不是会话参与者");
        }
        return conv;
    }

    // ===== 安全 JSON 处理（不依赖 Jackson） =====

    private String toJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> e : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(esc(e.getKey())).append("\":");
            appendVal(sb, e.getValue());
        }
        sb.append("}");
        return sb.toString();
    }

    private void appendVal(StringBuilder sb, Object v) {
        if (v == null) { sb.append("null"); }
        else if (v instanceof String) { sb.append("\"").append(esc((String) v)).append("\""); }
        else if (v instanceof Number || v instanceof Boolean) { sb.append(v); }
        else { sb.append("\"").append(esc(String.valueOf(v))).append("\""); }
    }

    /**
     * 安全转义 JSON 字符串中的特殊字符（包括控制字符）
     */
    private String esc(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isEmpty()) return null;
        Map<String, Object> map = new LinkedHashMap<>();
        String s = json.trim();
        if (s.startsWith("{")) s = s.substring(1);
        if (s.endsWith("}")) s = s.substring(0, s.length() - 1);

        int depth = 0; boolean inStr = false; int start = 0;
        List<String> pairs = new ArrayList<>();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' && (i == 0 || s.charAt(i - 1) != '\\')) inStr = !inStr;
            else if (!inStr && c == ',' && depth == 0) {
                pairs.add(s.substring(start, i).trim());
                start = i + 1;
            } else if (!inStr && (c == '{' || c == '[')) depth++;
            else if (!inStr && (c == '}' || c == ']')) depth--;
        }
        String last = s.substring(start).trim();
        if (!last.isEmpty()) pairs.add(last);

        for (String pair : pairs) {
            int ci = -1; inStr = false;
            for (int i = 0; i < pair.length(); i++) {
                char c = pair.charAt(i);
                if (c == '"' && (i == 0 || pair.charAt(i - 1) != '\\')) inStr = !inStr;
                else if (!inStr && c == ':') { ci = i; break; }
            }
            if (ci < 0) continue;
            String key = pair.substring(0, ci).trim();
            String val = pair.substring(ci + 1).trim();
            if (key.startsWith("\"") && key.endsWith("\"")) key = key.substring(1, key.length() - 1);
            map.put(key, parseVal(val));
        }
        return map;
    }

    private Object parseVal(String v) {
        if ("null".equals(v)) return null;
        if ("true".equals(v)) return true;
        if ("false".equals(v)) return false;
        if (v.startsWith("\"") && v.endsWith("\"")) return v.substring(1, v.length() - 1).replace("\\\"", "\"");
        try { return v.contains(".") ? new BigDecimal(v) : Long.valueOf(v); }
        catch (NumberFormatException e) { return v; }
    }

    private Long toLong(Object v) {
        if (v instanceof Integer) return ((Integer) v).longValue();
        if (v instanceof Long) return (Long) v;
        if (v instanceof BigDecimal) return ((BigDecimal) v).longValue();
        return Long.valueOf(String.valueOf(v));
    }

    private BigDecimal toBigDecimal(Object v) {
        if (v instanceof BigDecimal) return (BigDecimal) v;
        if (v instanceof Double) return BigDecimal.valueOf((Double) v);
        if (v instanceof Integer) return BigDecimal.valueOf((Integer) v);
        if (v instanceof Long) return BigDecimal.valueOf((Long) v);
        return new BigDecimal(String.valueOf(v));
    }
}
