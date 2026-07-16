package com.example.keshe_backend.user.dto;

import lombok.Data;

import java.util.List;

/**
 * 更新个人资料：头像 URL、个人简介、展示照片(最多5张 URL)。字段为 null 表示不改。
 */
@Data
public class UpdateProfileRequest {
    private String avatar;
    private String bio;
    private List<String> profilePhotos;
}
