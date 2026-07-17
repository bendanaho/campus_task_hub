package com.example.keshe_backend.common.api;

/**
 * 校验用的正则常量。放一处，避免同一规则在多个 DTO 里各写一份、日后改漏。
 */
public final class ValidationPatterns {

    /**
     * 邮箱格式，必须有顶级域。
     *
     * 不能只靠 jakarta 的 @Email：它默认按 RFC 放行没有点的域名（user@localhost 是合法的），
     * 于是 "someone@tongji" 这种投不出去的地址照样过——库里那条脏数据就是这么来的，
     * 实测也确认了裸 @Email 拦不住。
     *
     * 与前端 register/forgot-password 用的正则保持一致，避免前端放行、后端打回的割裂体验。
     */
    public static final String EMAIL = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

    private ValidationPatterns() {
    }
}
