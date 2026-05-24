package com.campus.taskhub.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class UserResponse {

    private Long id;

    private String username;

    private String phone;

    private String email;

    private String avatar;

    private BigDecimal creditScore;

    private Integer authStatus;

    private String college;

    private String className;

    private String bio;

    private BigDecimal balance;

    private Integer role;

    private LocalDateTime createdAt;
}