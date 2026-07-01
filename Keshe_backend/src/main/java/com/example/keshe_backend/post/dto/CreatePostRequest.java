package com.example.keshe_backend.post.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreatePostRequest {

    @NotBlank(message = "标题不能为空")
    private String title;

    @NotBlank(message = "发布身份不能为空")
    private String publisherSide; // payer / earner / none

    @NotBlank(message = "分类不能为空")
    private String category;

    @NotBlank(message = "描述不能为空")
    private String description;

    @NotBlank(message = "报酬描述不能为空")
    private String reward;

    private BigDecimal rewardValue;

    private List<String> images;

    private LocalDateTime deadline;

    private String contact;

    /**
     * 服务时间描述（仅 earner 类型）
     */
    private String serviceTime;
}
