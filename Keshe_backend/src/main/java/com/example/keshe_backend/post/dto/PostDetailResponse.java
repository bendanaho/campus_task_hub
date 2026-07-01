package com.example.keshe_backend.post.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 帖子详情响应（对齐 JS mockGetTaskDetail 返回格式）
 * { task: PostDTO, publisher: PostPublisherDTO }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostDetailResponse {
    private PostDTO task;
    private PostPublisherDTO publisher;
}
