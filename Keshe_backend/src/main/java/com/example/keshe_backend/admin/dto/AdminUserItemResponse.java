package com.example.keshe_backend.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 管理员看到的用户条目。
 *
 * 刻意不含 balance / realName / studentId / passwordHash：
 * 这个列表只服务于"人工重置密码"这一件事，管理员不需要看到用户的钱和实名信息。
 * hasEmail 只给布尔值不给地址——管理员判断该用户能不能自助找回，无须知道邮箱是什么。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserItemResponse {
    private Long id;
    private String username;
    private String phone;
    /** 是否绑定了邮箱：false 的用户无法自助找回，只能由管理员重置 */
    private Boolean hasEmail;
    private Integer authStatus;
    private Integer role;
    private String createdAt;
}
