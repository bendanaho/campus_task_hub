package com.example.keshe_backend.chat.controller;

import com.example.keshe_backend.chat.dto.*;
import com.example.keshe_backend.chat.service.ChatService;
import com.example.keshe_backend.common.api.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    /**
     * 会话列表
     */
    @GetMapping("/conversations")
    public ApiResponse<List<ConversationDTO>> getConversations() {
        return ApiResponse.success(chatService.getConversations());
    }

    /**
     * 会话列表（聚合版）：一次返回每个会话渲染所需的任务/订单/未读/已评价等数据，
     * 供消息中心一次拉取，避免前端逐会话 N+1 请求。
     */
    @GetMapping("/conversations/enriched")
    public ApiResponse<List<EnrichedConversationDTO>> getEnrichedConversations() {
        return ApiResponse.success(chatService.getEnrichedConversations());
    }

    /**
     * 确保会话存在
     */
    /**
     * 取得或创建 (任务, 双方) 的唯一会话。
     * 返回 chatId —— 可能与客户端提议的不同（已存在同一业务键的会话时复用既有的），
     * 客户端必须以返回值为准。
     */
    @PostMapping("/conversations/ensure")
    public ApiResponse<Map<String, String>> ensureConversation(
            @Valid @RequestBody EnsureConversationRequest request) {
        String chatId = chatService.ensureConversation(request);
        return ApiResponse.success(Map.of("chatId", chatId));
    }

    /**
     * 消息列表
     */
    @GetMapping("/conversations/{id}/messages")
    public ApiResponse<List<MessageDTO>> getMessages(@PathVariable String id) {
        return ApiResponse.success(chatService.getMessages(id));
    }

    /**
     * 发送消息
     */
    @PostMapping("/conversations/{id}/messages")
    public ApiResponse<MessageDTO> sendMessage(@PathVariable String id,
                                                @Valid @RequestBody SendMessageRequest request) {
        return ApiResponse.success(chatService.sendMessage(id, request.getContent(), request.getType()));
    }

    /**
     * 发送付款卡片
     */
    @PostMapping("/conversations/{id}/payment")
    public ApiResponse<MessageDTO> sendPaymentCard(@PathVariable String id,
                                                    @Valid @RequestBody SendPaymentRequest request) {
        return ApiResponse.success(chatService.sendPaymentCard(id, request));
    }

    /**
     * 标记已读
     */
    @PostMapping("/conversations/{id}/read")
    public ApiResponse<Map<String, Object>> markMessagesRead(@PathVariable String id) {
        int updated = chatService.markMessagesRead(id);
        return ApiResponse.success(Map.of("success", true, "updated", updated));
    }

    /**
     * 未读消息统计
     */
    @GetMapping("/messages/unread")
    public ApiResponse<UnreadCountResponse> getUnreadCounts() {
        return ApiResponse.success(chatService.getUnreadCounts());
    }

    /**
     * 支付收款卡片
     */
    @PostMapping("/messages/{id}/pay")
    public ApiResponse<MessageDTO> payPaymentCard(@PathVariable Long id) {
        return ApiResponse.success(chatService.payPaymentCard(id));
    }

    /**
     * 取消收款卡片
     */
    @PostMapping("/messages/{id}/cancel-payment")
    public ApiResponse<MessageDTO> cancelPaymentCard(@PathVariable Long id) {
        return ApiResponse.success(chatService.cancelPaymentCard(id));
    }

    /**
     * 撤回消息
     */
    @PostMapping("/messages/{id}/withdraw")
    public ApiResponse<MessageDTO> withdrawMessage(@PathVariable Long id) {
        return ApiResponse.success(chatService.withdrawMessage(id));
    }
}
