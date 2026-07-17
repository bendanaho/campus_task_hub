package com.example.keshe_backend.auth.controller;

import com.example.keshe_backend.auth.dto.LoginRequest;
import com.example.keshe_backend.auth.dto.LoginResponse;
import com.example.keshe_backend.auth.dto.RegisterRequest;
import com.example.keshe_backend.auth.dto.ResetPasswordRequest;
import com.example.keshe_backend.auth.dto.SendResetCodeRequest;
import com.example.keshe_backend.auth.service.AuthService;
import com.example.keshe_backend.auth.service.PasswordResetService;
import com.example.keshe_backend.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request));
    }

    @PostMapping("/register")
    public ApiResponse<Void> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ApiResponse.success();
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        // 最小可运行版本暂不维护 Token 黑名单
        // 后续可接入 Redis，将当前 Token 加入黑名单
        return ApiResponse.success();
    }

    @PostMapping("/login/wechat")
    public ApiResponse<Void> wechatLogin() {
        // 预留接口，本期暂不实现
        return ApiResponse.fail(1004, "微信登录暂未实现");
    }

    /**
     * 找回密码第一步：校验"账号 + 绑定邮箱"，通过则发验证码到该邮箱。
     */
    @PostMapping("/password/reset/send-code")
    public ApiResponse<Void> sendResetCode(@Valid @RequestBody SendResetCodeRequest request,
                                           HttpServletRequest servletRequest) {
        passwordResetService.sendCode(request, clientIp(servletRequest));
        return ApiResponse.success();
    }

    /**
     * 找回密码第二步：验证码 + 新密码一并提交，成功后旧 JWT 全部失效。
     */
    @PostMapping("/password/reset")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request);
        return ApiResponse.success();
    }

    /**
     * 取客户端 IP，用于发码限流。后端只监听 127.0.0.1、由 Nginx 反代，
     * 直接用 getRemoteAddr() 全站会共用一个限流桶。
     *
     * 只认 X-Real-IP，不认 X-Forwarded-For：本站 Nginx 配的是
     *   proxy_set_header X-Real-IP        $remote_addr;              → 覆盖写，客户端伪造不了
     *   proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for; → 在客户端传来的值后面追加
     * 也就是说 XFF 的首段是调用方自己填的。若按首段限流，攻击者每次换一个假 IP
     * 就能拿到一个新桶，限流形同虚设。X-Real-IP 由 Nginx 覆盖写入真实对端地址，可信。
     */
    private String clientIp(HttpServletRequest request) {
        String real = request.getHeader("X-Real-IP");
        return StringUtils.hasText(real) ? real.trim() : request.getRemoteAddr();
    }
}