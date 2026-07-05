package com.example.keshe_backend.report.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 帖子举报记录。一人一帖同一时间只保留一条 pending 举报（业务层去重）。
 */
@Data
@Entity
@Table(name = "reports")
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    /** 举报时的用户名快照，便于管理端展示 */
    @Column(name = "reporter_name", length = 50)
    private String reporterName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    /** pending 待处理 / handled 已处理（下架或删除后置为 handled） */
    @Column(nullable = false, length = 20)
    private String status = "pending";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = "pending";
    }
}
