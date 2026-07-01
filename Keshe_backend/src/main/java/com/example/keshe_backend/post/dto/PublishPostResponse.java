package com.example.keshe_backend.post.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 发布帖子响应（对齐 JS mockPublishPost 返回格式）
 * { success: true, task: PostDTO }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishPostResponse {
    private boolean success;
    private PostDTO task;

    public static PublishPostResponse of(PostDTO task) {
        return PublishPostResponse.builder().success(true).task(task).build();
    }
}
