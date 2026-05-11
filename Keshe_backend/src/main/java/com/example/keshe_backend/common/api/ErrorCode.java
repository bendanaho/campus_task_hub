package com.example.keshe_backend.common.api;

import lombok.Getter;

@Getter
public enum ErrorCode {

    SUCCESS(0, "成功"),

    PARAM_ERROR(1001, "请求参数非法"),
    UNAUTHORIZED(1002, "未登录或 Token 已过期"),
    FORBIDDEN(1003, "无权访问该资源"),
    NOT_FOUND(1004, "资源不存在"),
    CONFLICT(1005, "业务状态冲突"),

    LOGIN_FAILED(2001, "用户名/手机号/邮箱或密码错误"),
    USERNAME_EXISTS(2002, "该用户名已注册"),
    PHONE_EXISTS(2003, "该手机号已注册"),
    EMAIL_EXISTS(2004, "该邮箱已注册"),

    BALANCE_NOT_ENOUGH(3001, "余额不足，无法发布任务"),
    TASK_TAKEN(3002, "该任务已被他人接单"),
    TASK_NOT_FOUND_OR_CANCELLED(3003, "任务不存在或已取消"),
    ACTIVE_ORDER_EXISTS(3004, "已有进行中的订单，请先完成");

    private final Integer code;
    private final String message;

    ErrorCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}