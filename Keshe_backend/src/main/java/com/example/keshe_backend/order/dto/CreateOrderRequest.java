package com.example.keshe_backend.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateOrderRequest {
    @NotNull(message = "帖子ID不能为空")
    private Long postId;

    @NotBlank(message = "会话ID不能为空")
    private String chatId;
}
