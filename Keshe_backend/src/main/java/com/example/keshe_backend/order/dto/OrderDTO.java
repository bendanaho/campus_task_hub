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

    // 争议/仲裁字段（对齐 JS mock）
    private String disputeReason;
    private Long disputedBy;
    private LocalDateTime disputedAt;
    private String resolution;
    private BigDecimal resolutionAmountToEarner;
    private String resolutionNote;
    private LocalDateTime resolvedAt;

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
                .disputeReason(o.getDisputeReason())
                .disputedBy(o.getDisputedBy())
                .disputedAt(o.getDisputedAt())
                .resolution(o.getResolution())
                .resolutionAmountToEarner(o.getResolutionAmountToEarner())
                .resolutionNote(o.getResolutionNote())
                .resolvedAt(o.getResolvedAt())
                .build();
    }
}
