package com.example.keshe_backend.auth.service;

import com.example.keshe_backend.auth.dto.LoginRequest;
import com.example.keshe_backend.auth.dto.LoginResponse;
import com.example.keshe_backend.auth.dto.RegisterRequest;
import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.JwtUtil;
import com.example.keshe_backend.user.dto.SafeUserDTO;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public void register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException(ErrorCode.USERNAME_EXISTS);
        }

        if (userRepository.existsByPhone(request.getPhone())) {
            throw new BusinessException(ErrorCode.PHONE_EXISTS);
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()
                && userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(ErrorCode.EMAIL_EXISTS);
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPhone(request.getPhone());
        // 邮箱选填：空邮箱统一存 null 而非 ""。email 列有唯一约束，
        // 多个 null 视为互不相同（允许），但多个 "" 会撞唯一约束——
        // 否则第二个不填邮箱的用户注册就会失败（23505）。
        String email = request.getEmail();
        user.setEmail(email != null && !email.isBlank() ? email : null);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        userRepository.save(user);
    }

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getAccount())
                .or(() -> userRepository.findByPhone(request.getAccount()))
                .or(() -> userRepository.findByEmail(request.getAccount()))
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_FAILED));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.LOGIN_FAILED);
        }

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());

        return new LoginResponse(SafeUserDTO.from(user), token);
    }
}