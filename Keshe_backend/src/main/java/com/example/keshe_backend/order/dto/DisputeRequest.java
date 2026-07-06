package com.example.keshe_backend.order.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 发起申诉请求体
 */
@Data
public class DisputeRequest {

    @NotBlank(message = "请填写申诉理由")
    private String reason;
}
