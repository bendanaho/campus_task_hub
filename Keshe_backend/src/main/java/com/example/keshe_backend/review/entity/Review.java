package com.example.keshe_backend.review.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "reviews")
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 关联订单 ID
     */
    @Column(name = "order_id")
    private Long orderId;

    /**
     * 关联帖子 ID
     */
    @Column(name = "task_id")
    private Long taskId;

    /**
     * 评价者 ID
     */
    @Column(name = "from_user_id", nullable = false)
    private Long fromUserId;

    /**
     * 评价者名称
     */
    @Column(name = "from_user_name", nullable = false, length = 50)
    private String fromUserName;

    /**
     * 被评价者 ID
     */
    @Column(name = "to_user_id", nullable = false)
    private Long toUserId;

    /**
     * 被评价者名称
     */
    @Column(name = "to_user_name", nullable = false, length = 50)
    private String toUserName;

    /**
     * 评分 1-5
     */
    @Column(nullable = false)
    private Integer rating;

    /**
     * 评价内容
     */
    @Column(length = 500)
    private String content;

    /**
     * 评价图片列表（JSON 数组字符串）
     */
    @Column(columnDefinition = "LONGTEXT")
    private String images;

    /**
     * 是否系统自动生成的默认好评
     */
    @Column(nullable = false)
    private Boolean autoReview = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.autoReview == null) {
            this.autoReview = false;
        }
    }
}
