package com.example.keshe_backend.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateTaskRequest {

    @NotBlank(message = "标题不能为空")
    private String title;

    @NotBlank(message = "分类不能为空")
    private String category;

    @NotBlank(message = "描述不能为空")
    private String description;

    @NotBlank(message = "报酬不能为空")
    private String reward;

    private BigDecimal rewardValue;

    private LocalDateTime deadline;

    private String contact;

    private List<String> images;
}