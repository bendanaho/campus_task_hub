package com.example.keshe_backend.task.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    /**
     * 0=demand, 1=service
     */
    @Column(nullable = false)
    private Integer type;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "publisher_id", nullable = false)
    private Long publisherId;

    @Column(name = "publisher_name", nullable = false, length = 50)
    private String publisherName;

    @Column(name = "publisher_credit", nullable = false)
    private BigDecimal publisherCredit;

    /**
     * 报酬文本，例如：5元、面议
     */
    @Column(nullable = false, length = 50)
    private String reward;

    @Column(name = "reward_value", nullable = false)
    private BigDecimal rewardValue = BigDecimal.ZERO;

    private LocalDateTime deadline;

    @Column(name = "publish_time")
    private LocalDateTime publishTime;

    /**
     * 0=pending, 1=in_progress, 2=completed, 3=available
     */
    @Column(nullable = false)
    private Integer status;

    private String contact;

    /**
     * 最小版本先用 TEXT 存 JSON 字符串
     */
    @Column(columnDefinition = "TEXT")
    private String images;

    @Column(name = "taker_id")
    private Long takerId;

    @Column(name = "taker_name")
    private String takerName;

    /**
     * 0=frozen, 1=released
     */
    @Column(name = "payment_status")
    private Integer paymentStatus;

    @Column(name = "publisher_confirmed")
    private Integer publisherConfirmed = 0;

    @Column(name = "taker_confirmed")
    private Integer takerConfirmed = 0;

    @Version
    private Integer version;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        this.publishTime = now;

        if (this.rewardValue == null) {
            this.rewardValue = BigDecimal.ZERO;
        }

        if (this.publisherConfirmed == null) {
            this.publisherConfirmed = 0;
        }

        if (this.takerConfirmed == null) {
            this.takerConfirmed = 0;
        }

        if (this.contact == null) {
            this.contact = "站内联系";
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}