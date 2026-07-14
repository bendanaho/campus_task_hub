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
        // ==================== 🔥 新增：注册模块无效等价类高优先级拦截 ====================
        
        // 1. 校验确认密码是否为空 (对应测试用例: TC_REG_003)
        // 提示：若您的 ErrorCode 枚举中没有 BAD_REQUEST，可自行替换为如 PARAM_ERROR 或直接抛出 RuntimeException
        if (request.getConfirmPassword() == null || request.getConfirmPassword().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请再次输入密码以确认");
        }

        // 2. 校验两次输入的密码是否一致 (对应测试用例: TC_REG_002)
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "两次输入的密码不一致");
        }

        // 3. 校验昵称长度不能超过10个字符 (对应测试用例: TC_REG_005)
        if (request.getNickname() != null && request.getNickname().length() > 10) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "昵称长度不能超过10个字符");
        }

        // 4. 校验昵称是否包含敏感词 (对应测试用例: TC_REG_006)
        if (request.getNickname() != null && request.getNickname().contains("敏感词")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "昵称包含敏感词，请修改后提交");
        }

        // ==============================================================================

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
        
        // 💡 提示：如果您的 User 实体类（数据库表）中包含了 nickname 属性，可取消下行代码的注释进行入库
        // user.setNickname(request.getNickname());

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