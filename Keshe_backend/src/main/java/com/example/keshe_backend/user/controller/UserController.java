package com.example.keshe_backend.user.controller;

import com.example.keshe_backend.common.api.ApiResponse;
import com.example.keshe_backend.common.api.ErrorCode; // 引入统一错误码[cite: 5]
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
     * 获取本人完整资料(含敏感字段,仅本人可查)。
     * 查他人完整资料会被拒绝 —— 访问他人主页请用 /api/users/{id}/profile。
     */
    @GetMapping("/users/{id}")
    public ApiResponse<UserProfileResponse> getUserProfile(@PathVariable Long id) {
        return ApiResponse.success(userService.getUserProfile(id));
    }

    /**
     * 获取用户公开资料(他人主页用):仅公开字段,屏蔽手机/邮箱/实名/学号等敏感信息。
     */
    @GetMapping("/users/{id}/profile")
    public ApiResponse<UserPublicProfileDTO> getUserPublicProfile(@PathVariable Long id) {
        return ApiResponse.success(userService.getPublicProfile(id));
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
     * 修复测试点：TC_AUTH_003 (学号超长畸形拦截)[cite: 3]
     */
    @PutMapping("/user/profile")
    public ApiResponse<com.example.keshe_backend.user.dto.UserProfileResponse> updateProfile(
            @RequestBody com.example.keshe_backend.user.dto.UpdateProfileRequest request) {
        return ApiResponse.success(userService.updateProfile(request));
    }

    @PostMapping("/auth")
    public ApiResponse<?> submitAuth(@Valid @RequestBody SubmitAuthRequest request) {
        // 编程式高优先级拦截：学号长度超过30位直接阻断[cite: 3]
        if (request.getStudentId() != null && request.getStudentId().length() > 30) {
            return ApiResponse.error(ErrorCode.PARAM_ERROR, "学号格式不合法"); //[cite: 5]
        }
        
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
     * 修复测试点：TC_WAL_006 (充值过多小数位拦截)[cite: 3]
     */
    @PostMapping("/user/recharge")
    public ApiResponse<?> recharge(@Valid @RequestBody RechargeRequest request) {
        // 编程式高优先级拦截：校验金额小数位数是否超过2位[cite: 3]
        if (request.getAmount() != null && request.getAmount().scale() > 2) {
            return ApiResponse.error(ErrorCode.PARAM_ERROR, "金额最多支持两位小数"); //[cite: 5]
        }
        
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