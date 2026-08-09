package com.resume.api.controller;

import com.resume.api.common.Result;
import com.resume.api.dto.ChangePasswordRequest;
import com.resume.api.dto.LoginRequest;
import com.resume.api.dto.LogoutRequest;
import com.resume.api.dto.RefreshRequest;
import com.resume.api.dto.RegisterRequest;
import com.resume.api.security.CustomUserDetails;
import com.resume.api.service.AuthService;
import com.resume.api.vo.LoginVO;
import com.resume.api.vo.UserVO;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证接口：注册 / 登录 / 刷新 / 注销 / 当前用户 / 改密。
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public Result<UserVO> register(@Valid @RequestBody RegisterRequest request) {
        return Result.ok(authService.register(request));
    }

    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginRequest request) {
        return Result.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public Result<LoginVO> refresh(@Valid @RequestBody RefreshRequest request) {
        return Result.ok(authService.refresh(request));
    }

    @PostMapping("/logout")
    public Result<Void> logout(@AuthenticationPrincipal CustomUserDetails principal,
                               @Valid @RequestBody LogoutRequest request) {
        authService.logout(principal, request);
        return Result.ok(null);
    }

    @GetMapping("/me")
    public Result<UserVO> me(@AuthenticationPrincipal CustomUserDetails principal) {
        return Result.ok(authService.me(principal));
    }

    @PutMapping("/password")
    public Result<Void> changePassword(@AuthenticationPrincipal CustomUserDetails principal,
                                       @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(principal, request);
        return Result.ok(null);
    }
}
