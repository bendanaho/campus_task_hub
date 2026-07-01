package com.example.keshe_backend.order.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 关联的会话 ID（客户端生成，如 "c-t12-u3"）
     */
    @Column(name = "chat_id", nullable = false, length = 100)
    private String chatId;

    /**
     * 关联的帖子 ID
     */
    @Column(name = "post_id", nullable = false)
    private Long postId;

    /**
     * 付款方用户 ID
     */
    @Column(name = "payer_id", nullable = false)
    private Long payerId;

    /**
     * 收款方用户 ID
     */
    @Column(name = "earner_id", nullable = false)
    private Long earnerId;

    /**
     * 订单金额（纯互助为 0）
     */
    @Column(nullable = false)
    private BigDecimal amount = BigDecimal.ZERO;

    /**
     * 订单状态: pending / in_progress / completed / cancelled
     */
    @Column(nullable = false, length = 20)
    private String status = "pending";

    @Column(name = "payer_confirmed", nullable = false)
    private Boolean payerConfirmed = false;

    @Column(name = "earner_confirmed", nullable = false)
    private Boolean earnerConfirmed = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /**
     * 单方确认后设定的自动确认时间
     */
    @Column(name = "auto_confirm_at")
    private LocalDateTime autoConfirmAt;

    /**
     * 评价截止时间
     */
    @Column(name = "review_deadline")
    private LocalDateTime reviewDeadline;

    @Version
    private Integer version;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) {
            this.status = "pending";
        }
        if (this.amount == null) {
            this.amount = BigDecimal.ZERO;
        }
        if (this.payerConfirmed == null) {
            this.payerConfirmed = false;
        }
        if (this.earnerConfirmed == null) {
            this.earnerConfirmed = false;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
