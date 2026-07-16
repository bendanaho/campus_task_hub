package com.example.keshe_backend.auth.controller;

import com.example.keshe_backend.auth.dto.LoginRequest;
import com.example.keshe_backend.auth.dto.LoginResponse;
import com.example.keshe_backend.auth.dto.RegisterRequest;
import com.example.keshe_backend.auth.service.AuthService;
import com.example.keshe_backend.common.api.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

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
}