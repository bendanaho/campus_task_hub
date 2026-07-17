package com.example.keshe_backend.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 人工重置的结果：临时密码只在这一次响应里出现，不入库明文、不写日志。
 * 管理员线下转告用户，用户登录后自行修改。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminResetPasswordResponse {
    private Long userId;
    private String username;
    private String tempPassword;
}
