package com.example.keshe_backend.chat.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SendPaymentRequest {
    @NotNull(message = "对方用户ID不能为空")
    private Long partnerId;

    @NotBlank(message = "支付类型不能为空")
    private String kind; // "request"(收款) / "transfer"(转账)

    @DecimalMin(value = "0.01", message = "金额需大于 0")
    @DecimalMax(value = "100000.00", message = "金额不能超过 100,000")
    private BigDecimal amount;
}
