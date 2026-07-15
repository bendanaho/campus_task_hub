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

    // ===== 旧字段（保留兼容，Phase 3 后废弃） =====
    /**
     * @deprecated 改用 publisherSide
     */
    @Deprecated
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

    @Column(name = "publisher_credit", nullable = false, precision = 3, scale = 1)
    private BigDecimal publisherCredit;

    @Column(nullable = false, length = 50)
    private String reward;

    @Column(name = "reward_value", nullable = false)
    private BigDecimal rewardValue = BigDecimal.ZERO;

    private LocalDateTime deadline;

    @Column(name = "publish_time")
    private LocalDateTime publishTime;

    /**
     * 帖子状态: "open"(大厅可见) / "closed"(已关闭)
     */
    @Column(nullable = false, length = 10)
    private String status;

    private String contact;

    // 原图 base64 体积大；标记懒加载，避免大厅/列表查询把整列原图读进内存。
    // 列表 DTO(fromLite)也已剥离 full，双重保证大厅不加载原图。
    @Basic(fetch = FetchType.LAZY)
    @Column(columnDefinition = "LONGTEXT")
    private String images;

    // ===== 新字段 =====

    /**
     * 发布者身份: "payer"(我付钱-悬赏) / "earner"(我收钱-服务) / "none"(纯互助)
     */
    @Column(name = "publisher_side", nullable = false, length = 10)
    private String publisherSide = "payer";

    /**
     * 服务时间描述（仅 earner 类型使用）
     */
    @Column(name = "service_time", length = 100)
    private String serviceTime;

    // ===== 废弃字段（保留以兼容旧 schema，不再使用） =====
    @Deprecated
    @Column(name = "taker_id")
    private Long takerId;

    @Deprecated
    @Column(name = "taker_name")
    private String takerName;

    @Deprecated
    @Column(name = "payment_status")
    private Integer paymentStatus;

    @Deprecated
    @Column(name = "publisher_confirmed")
    private Integer publisherConfirmed;

    @Deprecated
    @Column(name = "taker_confirmed")
    private Integer takerConfirmed;

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
        if (this.status == null) {
            this.status = "open";
        }
        if (this.publisherSide == null) {
            this.publisherSide = "payer";
        }
        if (this.publisherCredit == null) {
            this.publisherCredit = BigDecimal.ZERO;
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
