package com.example.keshe_backend.common.api;

import lombok.Getter;

@Getter
public enum ErrorCode {

    SUCCESS(0, "成功"),

    // 框架级
    PARAM_ERROR(1001, "请求参数非法"),
    UNAUTHORIZED(1002, "未登录或 Token 已过期"),
    FORBIDDEN(1003, "无权访问该资源"),
    NOT_FOUND(1004, "资源不存在"),
    CONFLICT(1005, "业务状态冲突"),

    // 认证相关 2xxx
    LOGIN_FAILED(2001, "用户名/手机号/邮箱或密码错误"),
    USERNAME_EXISTS(2002, "该用户名已注册"),
    PHONE_EXISTS(2003, "该手机号已注册"),
    EMAIL_EXISTS(2004, "该邮箱已注册"),
    AUTH_REQUIRED(2005, "请先登录"),
    VERIFICATION_REQUIRED(2006, "请先完成实名认证后再操作"),

    // 订单/任务相关 3xxx
    BALANCE_NOT_ENOUGH(3001, "余额不足"),
    TASK_TAKEN(3002, "该任务已被他人接单"),
    TASK_NOT_FOUND_OR_CANCELLED(3003, "任务不存在或已取消"),
    ACTIVE_ORDER_EXISTS(3004, "已有进行中的订单"),
    SELF_DEALING(3005, "不能对自己发布的帖子下单/接单"),
    POST_EXPIRED(3006, "该悬赏已过截止时间，无法接单"),
    INVALID_ORDER_STATUS(3007, "订单当前状态不可操作"),
    DUPLICATE_ORDER(3008, "该帖子已有进行中的订单"),

    // 消息相关 4xxx
    WITHDRAW_TIMEOUT(4001, "已超过2分钟，无法撤回"),
    PAYMENT_ALREADY_PROCESSED(4002, "该收款已处理"),

    // 充值相关 5xxx
    RECHARGE_AMOUNT_INVALID(5001, "充值金额无效，需在 0.01 ~ 100,000 之间");

    private final Integer code;
    private final String message;

    ErrorCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
