package com.example.keshe_backend.review.controller;

import com.example.keshe_backend.common.api.ApiResponse;
import com.example.keshe_backend.review.dto.ReviewDTO;
import com.example.keshe_backend.review.dto.SubmitReviewRequest;
import com.example.keshe_backend.review.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    /**
     * 提交评价
     */
    @PostMapping
    public ApiResponse<ReviewDTO> submitReview(@Valid @RequestBody SubmitReviewRequest request) {
        return ApiResponse.success(reviewService.submitReview(request));
    }

    /**
     * 获取用户评价列表
     */
    @GetMapping
    public ApiResponse<List<ReviewDTO>> getReviews(@RequestParam Long userId) {
        return ApiResponse.success(reviewService.getReviews(userId));
    }

    /**
     * 检查是否已评价
     */
    @GetMapping("/has-reviewed")
    public ApiResponse<Map<String, Boolean>> hasReviewed(@RequestParam Long orderId) {
        return ApiResponse.success(Map.of("hasReviewed", reviewService.hasReviewed(orderId)));
    }
}
