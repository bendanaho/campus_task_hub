package com.example.keshe_backend.post.dto;

import com.example.keshe_backend.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 帖子详情中的发布者信息（对齐 JS 端 publisher 子对象）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostPublisherDTO {
    private Long id;
    private String username;
    private String avatar;
    private BigDecimal creditScore;

    public static PostPublisherDTO from(User user) {
        return PostPublisherDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .avatar(user.getAvatar())
                .creditScore(user.getCreditScore())
                .build();
    }
}
