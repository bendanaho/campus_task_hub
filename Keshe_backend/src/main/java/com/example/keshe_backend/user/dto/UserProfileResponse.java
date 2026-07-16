package com.example.keshe_backend.user.dto;

import com.example.keshe_backend.user.entity.User;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UserProfileResponse {
    private Long id;
    private String username;
    private String phone;
    private String email;
    private String avatar;
    private BigDecimal creditScore;
    private String authStatus; // "verified" / "unverified"（对齐 JS mock）
    private String realName;
    private String studentId;
    private String college;
    private String className;
    private String bio;
    private String profilePhotos; // JSON 数组字符串，展示照片 URL
    private Integer role;

    public static UserProfileResponse from(User user) {
        UserProfileResponse dto = new UserProfileResponse();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setPhone(user.getPhone());
        dto.setEmail(user.getEmail());
        dto.setAvatar(user.getAvatar());
        dto.setCreditScore(user.getCreditScore());
        dto.setAuthStatus(user.getAuthStatus() != null && user.getAuthStatus() == 1 ? "verified" : "unverified");
        dto.setRealName(user.getRealName());
        dto.setStudentId(user.getStudentId());
        dto.setCollege(user.getCollege());
        dto.setClassName(user.getClassName());
        dto.setBio(user.getBio());
        dto.setProfilePhotos(user.getProfilePhotos());
        dto.setRole(user.getRole());
        return dto;
    }
}
