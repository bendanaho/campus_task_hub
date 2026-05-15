package com.campus.taskhub.entity;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class User {

    private Long id;

    private String username;

    private String phone;

    private String email;

    private String passwordHash;

    private String wechatOpenid;

    private String wechatUnionid;

    private String avatar;

    private BigDecimal creditScore;

    private Integer authStatus;

    private String realName;

    private String studentId;

    private String college;

    private String className;

    private String bio;

    private BigDecimal balance;

    private Integer role;

    private Integer version;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime deletedAt;
}