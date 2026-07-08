package com.example.keshe_backend.user;

import com.example.keshe_backend.BaseIntegrationTest;
import com.example.keshe_backend.auth.dto.LoginRequest;
import com.example.keshe_backend.auth.dto.RegisterRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class UserAndAuthTest extends BaseIntegrationTest {

    @Test
    public void testRegisterAndLoginWorkflow() throws Exception {
        // 1. 测试成功注册
        RegisterRequest register = new RegisterRequest();
        register.setUsername("junit_user");
        register.setPhone("13811112222");
        register.setPassword("password123");

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // 2. 无效等价类：测试用户名重复注册，后端必须精准拦截并返回错误码
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("该用户名已被注册"));
    }

    @Test
    public void testUnverifiedUserCannotPublish() throws Exception {
        // 模拟未经过实名认证的用户尝试发布帖子，验证拦截器/业务层安全性
        String unverifiedUserToken = "Bearer mock_token_unverified_user"; 

        String postJson = "{\"title\":\"偷懒代取\",\"type\":\"PAYER\",\"reward\":20.0}";

        mockMvc.perform(post("/api/tasks/create")
                .header("Authorization", unverifiedUserToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(postJson))
                .andExpect(status().isForbidden()) // 或者 400 业务异常
                .andExpect(jsonPath("$.errorCode").value("USER_NOT_VERIFIED"));
    }
}