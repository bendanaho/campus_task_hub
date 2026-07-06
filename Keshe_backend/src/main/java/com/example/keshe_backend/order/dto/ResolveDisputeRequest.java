package com.example.keshe_backend.order.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 管理员裁决请求体。
 * decision: refund(全额退款) / settle(全额结算) / partial(部分结算)
 * amountToEarner: 仅 partial 时必填，0 < x < 订单金额
 */
@Data
public class ResolveDisputeRequest {

    @NotBlank(message = "请选择处理方式")
    private String decision;

    private BigDecimal amountToEarner;

    @NotBlank(message = "请填写处理说明")
    private String note;
}
