package com.example.keshe_backend.order.dto;

import com.example.keshe_backend.order.entity.Order;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderDTO {
    private Long id;
    private String chatId;
    private Long postId;
    private Long payerId;
    private Long earnerId;
    private BigDecimal amount;
    private String status;
    private Boolean payerConfirmed;
    private Boolean earnerConfirmed;
    private LocalDateTime createdAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime completedAt;
    private LocalDateTime autoConfirmAt;
    private LocalDateTime reviewDeadline;

    public static OrderDTO from(Order o) {
        return OrderDTO.builder()
                .id(o.getId())
                .chatId(o.getChatId())
                .postId(o.getPostId())
                .payerId(o.getPayerId())
                .earnerId(o.getEarnerId())
                .amount(o.getAmount())
                .status(o.getStatus())
                .payerConfirmed(o.getPayerConfirmed())
                .earnerConfirmed(o.getEarnerConfirmed())
                .createdAt(o.getCreatedAt())
                .acceptedAt(o.getAcceptedAt())
                .completedAt(o.getCompletedAt())
                .autoConfirmAt(o.getAutoConfirmAt())
                .reviewDeadline(o.getReviewDeadline())
                .build();
    }
}
