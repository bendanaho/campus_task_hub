package com.campus.taskhub.controller;

import com.campus.taskhub.common.Result;
import com.campus.taskhub.dto.LoginRequest;
import com.campus.taskhub.dto.LoginResponse;
import com.campus.taskhub.dto.RegisterRequest;
import com.campus.taskhub.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public Result<Map<String, Boolean>> register(@Valid @RequestBody RegisterRequest request) {
        userService.register(request);
        return Result.success(Map.of("success", true));
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse result = userService.login(request);
        return Result.success(result);
    }
}