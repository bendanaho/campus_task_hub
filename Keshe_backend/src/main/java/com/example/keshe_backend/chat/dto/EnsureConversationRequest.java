package com.example.keshe_backend.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EnsureConversationRequest {
    @NotBlank(message = "会话ID不能为空")
    private String chatId;

    @NotNull(message = "对方用户ID不能为空")
    private Long partnerId;

    private String partnerName;
    private Long taskId;
    private String taskTitle;
}
