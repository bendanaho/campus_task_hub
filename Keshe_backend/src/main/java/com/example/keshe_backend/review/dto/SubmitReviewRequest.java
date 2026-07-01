package com.example.keshe_backend.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class SubmitReviewRequest {
    @NotNull(message = "订单ID不能为空")
    private Long orderId;

    private Long taskId;

    @NotNull(message = "被评价者ID不能为空")
    private Long toUserId;

    @NotNull(message = "被评价者名称不能为空")
    private String toUserName;

    @Min(value = 1, message = "评分至少为 1")
    @Max(value = 5, message = "评分最多为 5")
    private int rating;

    private String content;

    private List<String> images;
}
