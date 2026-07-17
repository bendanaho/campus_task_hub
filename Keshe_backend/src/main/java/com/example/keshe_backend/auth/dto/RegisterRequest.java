package com.example.keshe_backend.auth.dto;

import com.example.keshe_backend.common.api.ValidationPatterns;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "用户名不能为空")
    private String username;

    @NotBlank(message = "手机号不能为空")
    private String phone;

    /**
     * 邮箱：由选填改为必填，且补上格式校验。
     * 邮箱现在是找回密码的唯一凭据，没绑邮箱的人只能走管理员人工重置。
     * 此前后端对 email 完全不校验（只有前端有正则），绕过前端直接调接口就能存进
     * "user@tongji" 这种没有顶级域、根本投不出去的地址——库里已经有一条。
     * 必须带 regexp：裸 @Email 按 RFC 放行无点域名，拦不住上面那种（已实测）。
     */
    @NotBlank(message = "邮箱不能为空")
    @Email(regexp = ValidationPatterns.EMAIL, message = "邮箱格式不正确")
    private String email;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, message = "密码长度不能少于 6 位")
    private String password;
}