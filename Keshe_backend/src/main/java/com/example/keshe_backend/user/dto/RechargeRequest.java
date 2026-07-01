package com.example.keshe_backend.user.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class RechargeRequest {
    @DecimalMin(value = "0.01", message = "充值金额需大于 0")
    @DecimalMax(value = "100000.00", message = "单笔充值不能超过 100,000")
    private BigDecimal amount;
}
