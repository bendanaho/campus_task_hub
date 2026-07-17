package com.example.keshe_backend.post.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
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

    /**
     * 由前端从 reward 文本解析出的确定金额，订单冻结/结算全用它（后端不解析 reward 字符串）。
     * 区间/面议这类没有确定金额的，前端传 0。
     *
     * 必须挡负数：PostService 只校验了小数位、没校验符号，于是绕过前端直接调接口就能传
     * rewardValue: -5 —— 库里已经有一条这样的帖（reward="-5元", reward_value=-5.00）。
     * 它没造成资金损失（WalletService 的 hold/release/refund 都有 signum()<=0 就返回的守卫），
     * 但 order.amount 会直接取这个值，负金额订单本身就不该存在。
     */
    @PositiveOrZero(message = "报酬金额不能为负")
    private BigDecimal rewardValue;

    private List<String> images;

    private LocalDateTime deadline;

    private String contact;

    /**
     * 服务时间描述（仅 earner 类型）
     */
    private String serviceTime;
}
