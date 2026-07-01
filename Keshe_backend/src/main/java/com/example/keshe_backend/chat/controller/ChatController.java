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
     * 确保会话存在
     */
    @PostMapping("/conversations/ensure")
    public ApiResponse<Map<String, Boolean>> ensureConversation(
            @Valid @RequestBody EnsureConversationRequest request) {
        chatService.ensureConversation(request);
        return ApiResponse.success(Map.of("success", true));
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
        return ApiResponse.success(chatService.sendMessage(id, request.getContent()));
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
