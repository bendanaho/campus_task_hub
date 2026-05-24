package com.campus.taskhub.controller;

import com.campus.taskhub.common.Result;
import com.campus.taskhub.dto.RegisterRequest;
import com.campus.taskhub.dto.UserResponse;
import com.campus.taskhub.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public Result<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        UserResponse user = userService.register(request);
        return Result.success(user);
    }
}