package com.example.keshe_backend.chat.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "conversations")
public class Conversation {

    /**
     * 会话 ID，由客户端生成（如 "c-t12-u3"）
     */
    @Id
    @Column(length = 100)
    private String id;

    /**
     * 参与者 1（当前用户视角）
     */
    @Column(name = "user1_id", nullable = false)
    private Long user1Id;

    /**
     * 参与者 2（对方）
     */
    @Column(name = "user2_id", nullable = false)
    private Long user2Id;

    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "task_title", length = 200)
    private String taskTitle;

    @Column(name = "last_message", columnDefinition = "TEXT")
    private String lastMessage;

    @Column(name = "last_time")
    private LocalDateTime lastTime;

    @Column(name = "last_message_sender_id")
    private Long lastMessageSenderId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
