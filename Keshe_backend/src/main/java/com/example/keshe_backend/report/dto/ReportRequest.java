package com.example.keshe_backend.report.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 举报请求体
 */
@Data
public class ReportRequest {

    @NotBlank(message = "请填写举报理由")
    private String reason;
}
