package com.example.keshe_backend.user.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 用户名
     */
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    /**
     * 手机号
     */
    @Column(nullable = false, unique = true, length = 20)
    private String phone;

    /**
     * 邮箱
     */
    @Column(unique = true, length = 100)
    private String email;

    /**
     * 密码哈希
     */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /**
     * 微信 openid，预留给小程序登录
     */
    @Column(name = "wechat_openid", unique = true, length = 100)
    private String wechatOpenid;

    /**
     * 微信 unionid，预留
     */
    @Column(name = "wechat_unionid", length = 100)
    private String wechatUnionid;

    private String avatar;

    @Column(name = "credit_score", nullable = false, precision = 3, scale = 1)
    private BigDecimal creditScore = new BigDecimal("5.0");

    /**
     * 0=未认证，1=已认证
     */
    @Column(name = "auth_status", nullable = false)
    private Integer authStatus = 0;

    @Column(name = "real_name", length = 50)
    private String realName;

    @Column(name = "student_id", length = 50)
    private String studentId;

    private String college;

    @Column(name = "class_name")
    private String className;

    private String bio;

    @Column(nullable = false)
    private BigDecimal balance = BigDecimal.ZERO;

    /**
     * 0=user，1=admin
     */
    @Column(nullable = false)
    private Integer role = 0;

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
        if (this.creditScore == null) {
            this.creditScore = new BigDecimal("5.0");
        }
        if (this.balance == null) {
            this.balance = BigDecimal.ZERO;
        }
        if (this.authStatus == null) {
            this.authStatus = 0;
        }
        if (this.role == null) {
            this.role = 0;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}