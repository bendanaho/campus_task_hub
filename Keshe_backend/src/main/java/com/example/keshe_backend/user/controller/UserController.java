package com.example.keshe_backend.user.controller;

import com.example.keshe_backend.common.api.ApiResponse;
import com.example.keshe_backend.user.dto.*;
import com.example.keshe_backend.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * 获取用户公开资料
     */
    @GetMapping("/users/{id}")
    public ApiResponse<UserProfileResponse> getUserProfile(@PathVariable Long id) {
        return ApiResponse.success(userService.getUserProfile(id));
    }

    /**
     * 修改手机号
     */
    @PutMapping("/user/phone")
    public ApiResponse<UserProfileResponse> updatePhone(@Valid @RequestBody UpdatePhoneRequest request) {
        return ApiResponse.success(userService.updatePhone(request.getPhone()));
    }

    /**
     * 修改邮箱
     */
    @PutMapping("/user/email")
    public ApiResponse<UserProfileResponse> updateEmail(@Valid @RequestBody UpdateEmailRequest request) {
        return ApiResponse.success(userService.updateEmail(request.getEmail()));
    }

    /**
     * 提交实名认证
     */
    @PostMapping("/auth")
    public ApiResponse<UserProfileResponse> submitAuth(@Valid @RequestBody SubmitAuthRequest request) {
        return ApiResponse.success(userService.submitAuth(
                request.getRealName(), request.getStudentId(),
                request.getCollege(), request.getClassName()));
    }

    /**
     * 查询余额
     */
    @GetMapping("/user/balance")
    public ApiResponse<BalanceResponse> getBalance() {
        return ApiResponse.success(userService.getBalance());
    }

    /**
     * 充值
     */
    @PostMapping("/user/recharge")
    public ApiResponse<BalanceResponse> recharge(@Valid @RequestBody RechargeRequest request) {
        return ApiResponse.success(userService.recharge(request.getAmount()));
    }

    /**
     * 账单流水
     */
    @GetMapping("/user/bills")
    public ApiResponse<BillsResponse> getBills() {
        return ApiResponse.success(userService.getBills());
    }
}
