package com.example.keshe_backend.auth.dto;

import com.example.keshe_backend.common.api.ValidationPatterns;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SendResetCodeRequest {

    /** 用户名 / 手机号 / 邮箱，与登录的 account 同义 */
    @NotBlank(message = "账号不能为空")
    private String account;

    /** 该账号绑定的邮箱，必须与库里一致 */
    @NotBlank(message = "邮箱不能为空")
    @Email(regexp = ValidationPatterns.EMAIL, message = "邮箱格式不正确")
    private String email;
}
