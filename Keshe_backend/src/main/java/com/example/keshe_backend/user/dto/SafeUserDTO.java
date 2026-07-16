package com.example.keshe_backend.user.dto;

import com.example.keshe_backend.user.entity.User;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SafeUserDTO {

    private Long id;
    private String username;
    private String phone;
    private String email;
    private String avatar;
    private BigDecimal creditScore;
    private String authStatus; // "verified" / "unverified"（对齐 JS mock）
    private String college;
    private String className;
    private String bio;
    private String profilePhotos;
    private Integer role;

    public static SafeUserDTO from(User user) {
        SafeUserDTO dto = new SafeUserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setPhone(maskPhone(user.getPhone()));
        dto.setEmail(maskEmail(user.getEmail()));
        dto.setAvatar(user.getAvatar());
        dto.setCreditScore(user.getCreditScore());
        dto.setAuthStatus(user.getAuthStatus() != null && user.getAuthStatus() == 1 ? "verified" : "unverified");
        dto.setCollege(user.getCollege());
        dto.setClassName(user.getClassName());
        dto.setBio(user.getBio());
        dto.setProfilePhotos(user.getProfilePhotos());
        dto.setRole(user.getRole());
        return dto;
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    private static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return email;
        }
        String[] parts = email.split("@");
        if (parts[0].length() <= 2) {
            return "***@" + parts[1];
        }
        return parts[0].substring(0, 2) + "***@" + parts[1];
    }
}