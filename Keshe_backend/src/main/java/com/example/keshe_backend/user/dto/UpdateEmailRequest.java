package com.example.keshe_backend.user.dto;

import com.example.keshe_backend.common.api.ValidationPatterns;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateEmailRequest {
    @NotBlank(message = "邮箱不能为空")
    @Email(regexp = ValidationPatterns.EMAIL, message = "邮箱格式不正确")
    private String email;

    /**
     * 当前密码。绑定/更换邮箱一律验密码——邮箱是找回密码的唯一凭据，
     * 换邮箱等同于换掉账号的备用钥匙。若只凭登录态就能改，
     * 任何拿到会话的人（例如机房里没登出的浏览器）都能把邮箱换成自己的，
     * 再走一遍"忘记密码"，账号连同余额一并接管——邮箱验证就形同虚设。
     */
    @NotBlank(message = "请输入当前密码")
    private String currentPassword;
}
