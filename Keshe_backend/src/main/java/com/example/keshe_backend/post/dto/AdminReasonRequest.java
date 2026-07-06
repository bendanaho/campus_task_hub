package com.example.keshe_backend.post.dto;

import lombok.Data;

/**
 * 管理员下架/删除帖子的原因（可选，随系统通知告知发布者）
 */
@Data
public class AdminReasonRequest {
    private String reason;
}
