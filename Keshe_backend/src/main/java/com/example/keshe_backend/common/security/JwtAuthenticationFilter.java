package com.example.keshe_backend.common.security;

import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = extractToken(request);

        if (StringUtils.hasText(token)) {
            try {
                Long userId = jwtUtil.getUserIdFromToken(token);
                Optional<User> userOpt = userRepository.findById(userId);

                if (userOpt.isPresent() && tokenVersionMatches(token, userOpt.get())) {
                    User user = userOpt.get();
                    // role=1 的用户额外授予 ROLE_ADMIN，供 /api/admin/** 鉴权
                    List<SimpleGrantedAuthority> authorities =
                            user.getRole() != null && user.getRole() == 1
                                    ? List.of(new SimpleGrantedAuthority("ROLE_USER"),
                                              new SimpleGrantedAuthority("ROLE_ADMIN"))
                                    : List.of(new SimpleGrantedAuthority("ROLE_USER"));
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    user.getId(),
                                    null,
                                    authorities
                            );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception e) {
                // Token 无效或已过期，清空上下文
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * 令牌代次比对：改密码/找回/管理员重置会把 user.tokenVersion +1，使旧 JWT 立即作废。
     *
     * 本次改动之前签发的 token 没有 tv 声明 → 按 0 处理。所有存量用户的 tokenVersion 初始也是 0，
     * 于是老 token 继续有效，上线不会把在线用户全踢下线；而一旦谁重置了密码，其 tokenVersion 变 1，
     * 老 token 的 0 就对不上了，照样被拒——安全性一分不少，只是不做无谓的强制登出。
     *
     * 这里不额外查库：外层为了取 role 本来就 findById 了一次。
     */
    private boolean tokenVersionMatches(String token, User user) {
        Integer claimed = jwtUtil.getTokenVersionFromToken(token);
        int fromToken = claimed == null ? 0 : claimed;
        int current = user.getTokenVersion() == null ? 0 : user.getTokenVersion();
        return fromToken == current;
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
