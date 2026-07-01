package com.example.keshe_backend.common.logging;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * 简洁的业务日志拦截器——每请求一行。
 */
@Slf4j
@Component
public class RequestLoggingInterceptor implements HandlerInterceptor {

    private static final DateTimeFormatter TF = DateTimeFormatter.ofPattern("HH:mm:ss");

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute("_start", System.currentTimeMillis());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        Long start = (Long) request.getAttribute("_start");
        long ms = start != null ? System.currentTimeMillis() - start : 0;
        int status = response.getStatus();
        String method = request.getMethod();
        String path = request.getRequestURI();

        String user = "匿名";
        if (request.getUserPrincipal() != null) {
            user = request.getUserPrincipal().getName();
        }

        String icon = status >= 400 ? "✗" : "✓";
        log.info("{} {} {} {} → {} ({}ms)", icon, method, path, user, status, ms);
    }
}
