package com.resume.api.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * JWT 鉴权占位实现。
 * <p>
 * 真实实现将解析 Authorization: Bearer &lt;token&gt;，校验后把 userId 写入 request。
 * 当前固定使用占位用户 1L，保证 CRUD 链路可跑通。
 */
@Component
public class JwtAuthInterceptor implements HandlerInterceptor {

    private static final Long PLACEHOLDER_USER_ID = 1L;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute("userId", PLACEHOLDER_USER_ID);
        return true;
    }
}
