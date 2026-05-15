package com.campus.taskhub.service.impl;

import com.campus.taskhub.common.BusinessException;
import com.campus.taskhub.dto.RegisterRequest;
import com.campus.taskhub.dto.UserResponse;
import com.campus.taskhub.entity.User;
import com.campus.taskhub.mapper.UserMapper;
import com.campus.taskhub.service.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;

    private final PasswordEncoder passwordEncoder;

    public UserServiceImpl(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserResponse register(RegisterRequest request) {

        // 1. 去掉前后空格
        String username = request.getUsername().trim();
        String phone = request.getPhone().trim();
        String email = request.getEmail();

        if (email != null && !email.trim().isEmpty()) {
            email = email.trim();
        } else {
            email = null;
        }

        // 2. 检查用户名是否已存在
        User usernameUser = userMapper.findByUsername(username);
        if (usernameUser != null) {
            throw new BusinessException(4001, "用户名已存在");
        }

        // 3. 检查手机号是否已存在
        User phoneUser = userMapper.findByPhone(phone);
        if (phoneUser != null) {
            throw new BusinessException(4002, "手机号已注册");
        }

        // 4. 如果邮箱不为空，检查邮箱是否已存在
        if (email != null) {
            User emailUser = userMapper.findByEmail(email);
            if (emailUser != null) {
                throw new BusinessException(4003, "邮箱已注册");
            }
        }

        // 5. 密码加密，不能明文存数据库
        String passwordHash = passwordEncoder.encode(request.getPassword());

        // 6. 创建 User 对象
        User user = new User();
        user.setUsername(username);
        user.setPhone(phone);
        user.setEmail(email);
        user.setPasswordHash(passwordHash);

        // 默认字段
        user.setCreditScore(new BigDecimal("5.0"));
        user.setAuthStatus(0);
        user.setBalance(new BigDecimal("0.00"));
        user.setRole(0);
        user.setVersion(0);

        // 7. 插入数据库
        int rows = userMapper.insertUser(user);
        if (rows != 1) {
            throw new BusinessException("注册失败，请稍后重试");
        }

        // 8. 转成返回对象，不能返回 passwordHash
        return convertToUserResponse(user);
    }

    private UserResponse convertToUserResponse(User user) {
        UserResponse response = new UserResponse();

        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setPhone(user.getPhone());
        response.setEmail(user.getEmail());
        response.setAvatar(user.getAvatar());
        response.setCreditScore(user.getCreditScore());
        response.setAuthStatus(user.getAuthStatus());
        response.setCollege(user.getCollege());
        response.setClassName(user.getClassName());
        response.setBio(user.getBio());
        response.setBalance(user.getBalance());
        response.setRole(user.getRole());
        response.setCreatedAt(user.getCreatedAt());

        return response;
    }
}