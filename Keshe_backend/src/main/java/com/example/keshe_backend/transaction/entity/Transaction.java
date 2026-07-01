package com.example.keshe_backend.transaction.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 用户 ID
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 资金方向: "in"(收入) / "out"(支出)
     */
    @Column(nullable = false, length = 10)
    private String direction;

    /**
     * 金额
     */
    @Column(nullable = false)
    private BigDecimal amount;

    /**
     * 类别: "order"(订单) / "recharge"(充值) / "payment"(聊天支付)
     */
    @Column(nullable = false, length = 20)
    private String category;

    /**
     * 关联 ID（订单 ID、消息 ID 等）
     */
    @Column(name = "related_id", length = 100)
    private String relatedId;

    /**
     * 备注
     */
    @Column(length = 500)
    private String note = "";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.note == null) {
            this.note = "";
        }
    }
}
