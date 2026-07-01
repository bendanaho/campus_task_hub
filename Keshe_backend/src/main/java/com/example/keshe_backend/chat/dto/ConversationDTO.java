package com.example.keshe_backend.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationDTO {
    private String id;
    private Long partnerId;
    private String partnerName;
    private String partnerAvatar;
    private Long taskId;
    private String taskTitle;
    private String lastMessage;
    private LocalDateTime lastTime;
    private Long lastMessageSenderId;
}
