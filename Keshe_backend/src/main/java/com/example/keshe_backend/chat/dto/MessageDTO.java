package com.example.keshe_backend.chat.dto;

import com.example.keshe_backend.chat.entity.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageDTO {
    private Long id;
    private String chatId;
    private Long senderId;
    private String senderName;
    private Long receiverId;
    private String content;
    private String type;
    private LocalDateTime time;
    private String taskId;
    private String taskTitle;
    private Boolean withdrawn;
    private Boolean read;
    private String payment;

    public static MessageDTO from(Message m) {
        return MessageDTO.builder()
                .id(m.getId())
                .chatId(m.getChatId())
                .senderId(m.getSenderId())
                .senderName(m.getSenderName())
                .receiverId(m.getReceiverId())
                .content(m.getContent())
                .type(m.getType())
                .time(m.getTime())
                .taskId(m.getTaskId())
                .taskTitle(m.getTaskTitle())
                .withdrawn(m.getWithdrawn())
                .read(m.getRead())
                .payment(m.getPayment())
                .build();
    }
}
