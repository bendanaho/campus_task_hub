package com.example.keshe_backend.post.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 帖子分页响应（互助大厅分页加载）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostPageResponse {
    private List<PostDTO> list;
    private boolean hasMore;
    private long total;
    private int page;
    private int size;
}
