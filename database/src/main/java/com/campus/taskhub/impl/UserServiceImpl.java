package com.campus.taskhub.service.impl;

import com.campus.taskhub.common.BusinessException;
import com.campus.taskhub.dto.LoginRequest;
import com.campus.taskhub.dto.LoginResponse;
import com.campus.taskhub.dto.RegisterRequest;
import com.campus.taskhub.dto.UserResponse;
import com.campus.taskhub.entity.User;
import com.campus.taskhub.mapper.UserMapper;
import com.campus.taskhub.service.UserService;
import com.campus.taskhub.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class UserServiceImpl implements UserService {

    private static final Logger log = LoggerFactory.getLogger(UserServiceImpl.class);

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public UserServiceImpl(UserMapper userMapper, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void register(RegisterRequest request) {

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
            throw new BusinessException(2002, "该用户名已注册");
        }

        // 3. 检查手机号是否已存在
        User phoneUser = userMapper.findByPhone(phone);
        if (phoneUser != null) {
            throw new BusinessException(2003, "该手机号已注册");
        }

        // 4. 如果邮箱不为空，检查邮箱是否已存在
        if (email != null) {
            User emailUser = userMapper.findByEmail(email);
            if (emailUser != null) {
                throw new BusinessException(2004, "该邮箱已注册");
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
        user.setCreditScore(new BigDecimal("100"));

        // 7. 插入数据库（含并发保护：数据库唯一索引兜底）
        try {
            int rows = userMapper.insertUser(user);
            if (rows != 1) {
                throw new BusinessException("注册失败，请稍后重试");
            }
        } catch (DuplicateKeyException e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("username")) {
                throw new BusinessException(2002, "该用户名已注册");
            } else if (msg != null && msg.contains("phone")) {
                throw new BusinessException(2003, "该手机号已注册");
            } else if (msg != null && msg.contains("email")) {
                throw new BusinessException(2004, "该邮箱已注册");
            }
            throw new BusinessException("注册失败，请稍后重试");
        }

        // 8. 操作日志（手机号脱敏）
        log.info("用户注册成功 | userId={} | username={} | phone={}",
                user.getId(),
                username,
                phone.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2"));
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        String username = request.getUsername().trim();

        User user = userMapper.findByUsername(username);
        if (user == null) {
            throw new BusinessException(4004, "用户名或密码错误");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException(4004, "用户名或密码错误");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());

        LoginResponse response = new LoginResponse();
        response.setToken(token);
        response.setUser(convertToUserResponse(user));
        return response;
    }

    private UserResponse convertToUserResponse(User user) {
        UserResponse response = new UserResponse();

        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setPhone(user.getPhone());
        response.setEmail(user.getEmail());
        response.setAvatarUrl(user.getAvatarUrl());
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