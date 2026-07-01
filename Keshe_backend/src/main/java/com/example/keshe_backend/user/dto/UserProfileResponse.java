package com.example.keshe_backend.user.dto;

import com.example.keshe_backend.user.entity.User;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 用户公开资料响应（对齐 JS mockGetUserProfile 返回格式）
 */
@Data
public class UserProfileResponse {
    private Long id;
    private String username;
    private String phone;
    private String email;
    private String avatar;
    private BigDecimal creditScore;
    private Integer authStatus; // 0=未认证 1=已认证
    private String realName;
    private String studentId;
    private String college;
    private String className;
    private String bio;
    private Integer role;

    public static UserProfileResponse from(User user) {
        UserProfileResponse dto = new UserProfileResponse();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setPhone(user.getPhone());
        dto.setEmail(user.getEmail());
        dto.setAvatar(user.getAvatar());
        dto.setCreditScore(user.getCreditScore());
        dto.setAuthStatus(user.getAuthStatus());
        dto.setRealName(user.getRealName());
        dto.setStudentId(user.getStudentId());
        dto.setCollege(user.getCollege());
        dto.setClassName(user.getClassName());
        dto.setBio(user.getBio());
        dto.setRole(user.getRole());
        return dto;
    }
}
