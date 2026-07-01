package com.example.keshe_backend.chat.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "chat_messages")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 所属会话 ID
     */
    @Column(name = "chat_id", nullable = false, length = 100)
    private String chatId;

    /**
     * 发送者 ID（系统消息可为 null）
     */
    @Column(name = "sender_id")
    private Long senderId;

    /**
     * 发送者名称（冗余）
     */
    @Column(name = "sender_name", length = 50)
    private String senderName;

    /**
     * 接收者 ID
     */
    @Column(name = "receiver_id")
    private Long receiverId;

    /**
     * 消息内容
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /**
     * 消息类型: "text" / "system" / "payment"
     */
    @Column(nullable = false, length = 20)
    private String type = "text";

    @Column(nullable = false)
    private LocalDateTime time;

    /**
     * 关联任务 ID（冗余，方便展示）
     */
    @Column(name = "task_id", length = 50)
    private String taskId;

    /**
     * 关联任务标题（冗余）
     */
    @Column(name = "task_title", length = 200)
    private String taskTitle;

    /**
     * 是否已撤回
     */
    @Column(nullable = false)
    private Boolean withdrawn = false;

    /**
     * 接收方是否已读
     */
    @Column(name = "is_read", nullable = false)
    private Boolean read = false;

    /**
     * 支付信息 JSON（type=payment 时使用）
     * 格式: {"kind":"request|transfer","amount":15,"status":"pending|paid|cancelled","payerId":1,"payerName":"...","receiverId":2,"receiverName":"...","paidAt":null}
     */
    @Column(columnDefinition = "TEXT")
    private String payment;

    @PrePersist
    public void prePersist() {
        if (this.time == null) {
            this.time = LocalDateTime.now();
        }
        if (this.type == null) {
            this.type = "text";
        }
        if (this.withdrawn == null) {
            this.withdrawn = false;
        }
        if (this.read == null) {
            this.read = false;
        }
    }
}
