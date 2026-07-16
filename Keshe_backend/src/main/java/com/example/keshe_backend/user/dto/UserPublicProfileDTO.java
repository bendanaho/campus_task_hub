package com.example.keshe_backend.user.dto;

import com.example.keshe_backend.user.entity.User;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 用户公开资料(他人主页用):只含可对外展示的字段,
 * 屏蔽 phone / email / realName / studentId / balance / frozenBalance / role 等敏感信息。
 */
@Data
public class UserPublicProfileDTO {
    private Long id;
    private String username;
    private String avatar;
    private BigDecimal creditScore;
    private String authStatus; // "verified" / "unverified"（仅作认证徽章,不暴露学号/真实姓名）
    private String college;
    private String className;
    private String bio;
    private String profilePhotos; // JSON 数组字符串,展示照片 URL

    public static UserPublicProfileDTO from(User user) {
        UserPublicProfileDTO dto = new UserPublicProfileDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setAvatar(user.getAvatar());
        dto.setCreditScore(user.getCreditScore());
        dto.setAuthStatus(user.getAuthStatus() != null && user.getAuthStatus() == 1 ? "verified" : "unverified");
        dto.setCollege(user.getCollege());
        dto.setClassName(user.getClassName());
        dto.setBio(user.getBio());
        dto.setProfilePhotos(user.getProfilePhotos());
        return dto;
    }
}
