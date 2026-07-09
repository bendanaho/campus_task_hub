package com.example.keshe_backend.post.controller;

import com.example.keshe_backend.common.api.ApiResponse;
import com.example.keshe_backend.post.dto.*;
import com.example.keshe_backend.post.service.PostService;
import com.example.keshe_backend.report.dto.ReportRequest;
import com.example.keshe_backend.report.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;
    private final ReportService reportService;

    /**
     * 帖子列表（大厅，分页）
     */
    @GetMapping
    public ApiResponse<PostPageResponse> listPosts(
            @RequestParam(required = false) String side,
            @RequestParam(required = false) String categories,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.success(postService.listPosts(side, categories, keyword, sort, page, size));
    }

    /**
     * 帖子详情
     */
    @GetMapping("/{id}")
    public ApiResponse<PostDetailResponse> getPostDetail(@PathVariable Long id) {
        return ApiResponse.success(postService.getPostDetail(id));
    }

    /**
     * 发布帖子
     */
    @PostMapping
    public ApiResponse<PublishPostResponse> createPost(@Valid @RequestBody CreatePostRequest request) {
        return ApiResponse.success(postService.createPost(request));
    }

    /**
     * 我的帖子
     */
    @GetMapping("/mine")
    public ApiResponse<List<PostDTO>> getMyPosts() {
        return ApiResponse.success(postService.getMyPosts());
    }

    /**
     * 举报帖子（登录的普通用户）
     */
    @PostMapping("/{id}/report")
    public ApiResponse<Void> reportPost(@PathVariable Long id,
                                        @Valid @RequestBody ReportRequest request) {
        reportService.reportPost(id, request.getReason());
        return ApiResponse.success();
    }
}
