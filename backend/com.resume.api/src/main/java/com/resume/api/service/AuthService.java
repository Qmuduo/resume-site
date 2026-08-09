package com.resume.api.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import com.resume.api.config.JwtProperties;
import com.resume.api.config.LoginFailProperties;
import com.resume.api.dto.ChangePasswordRequest;
import com.resume.api.dto.LoginRequest;
import com.resume.api.dto.LogoutRequest;
import com.resume.api.dto.RefreshRequest;
import com.resume.api.dto.RegisterRequest;
import com.resume.api.entity.User;
import com.resume.api.repository.UserMapper;
import com.resume.api.security.CustomUserDetails;
import com.resume.api.security.JwtTokenService;
import com.resume.api.security.JwtTokenService.TokenPair;
import com.resume.api.vo.LoginVO;
import com.resume.api.vo.UserVO;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 认证服务：注册 / 登录（含 Redis 限频）/ 刷新（轮换）/ 注销 / 当前用户 / 改密。
 */
@Service
public class AuthService {

    private static final String LOGIN_FAIL_PREFIX = "login_fail:";
    private static final String LOGIN_LOCK_PREFIX = "login_lock:";

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final StringRedisTemplate redisTemplate;
    private final JwtProperties jwtProperties;
    private final LoginFailProperties loginFailProperties;

    public AuthService(UserMapper userMapper,
                       PasswordEncoder passwordEncoder,
                       JwtTokenService jwtTokenService,
                       StringRedisTemplate redisTemplate,
                       JwtProperties jwtProperties,
                       LoginFailProperties loginFailProperties) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.redisTemplate = redisTemplate;
        this.jwtProperties = jwtProperties;
        this.loginFailProperties = loginFailProperties;
    }

    public UserVO register(RegisterRequest request) {
        Long count = userMapper.selectCount(
                Wrappers.<User>lambdaQuery().eq(User::getUsername, request.getUsername()));
        if (count != null && count > 0) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setEmail(trimToNull(request.getEmail()));
        user.setNickname(trimToNull(request.getNickname()));
        user.setRole("USER");
        userMapper.insert(user);
        return UserVO.from(user);
    }

    public LoginVO login(LoginRequest request) {
        checkLocked(request.getUsername());
        User user = userMapper.selectOne(
                Wrappers.<User>lambdaQuery().eq(User::getUsername, request.getUsername()));
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            onLoginFail(request.getUsername());
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "用户名或密码错误");
        }
        onLoginSuccess(request.getUsername());
        return issueLogin(user);
    }

    /**
     * 刷新即轮换：校验签名 + Redis 匹配后删除旧 refreshToken，签发全新双 token。
     */
    public LoginVO refresh(RefreshRequest request) {
        Claims claims;
        try {
            claims = jwtTokenService.parse(request.getRefreshToken());
        } catch (JwtException e) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "刷新令牌无效或已过期");
        }
        Long userId = Long.valueOf(claims.getSubject());
        String jti = claims.getId();
        if (!jwtTokenService.matchRefreshToken(userId, jti, request.getRefreshToken())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "刷新令牌无效或已过期");
        }
        jwtTokenService.deleteRefreshToken(userId, jti);
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "用户不存在");
        }
        return issueLogin(user);
    }

    /**
     * 注销：当前 accessToken 的 jti 进黑名单，refreshToken 从 Redis 删除；refreshToken 无效也幂等返回成功。
     */
    public void logout(CustomUserDetails principal, LogoutRequest request) {
        jwtTokenService.blacklistAccess(principal.getJti(), principal.getExp());
        try {
            Claims claims = jwtTokenService.parse(request.getRefreshToken());
            jwtTokenService.deleteRefreshToken(Long.valueOf(claims.getSubject()), claims.getId());
        } catch (JwtException | NumberFormatException e) {
            // 忽略无效 refreshToken，access token 已作废
        }
    }

    /**
     * 当前用户：纯 JWT claims 直出，不查库。
     */
    public UserVO me(CustomUserDetails principal) {
        return new UserVO(principal.getId(), principal.getUsername(), principal.getNickname(),
                null, principal.getRole(), null);
    }

    /**
     * 改密：校验原密码后更新 BCrypt 哈希，删除该用户全部 refreshToken 并黑名单当前 accessToken，强制重新登录。
     */
    public void changePassword(CustomUserDetails principal, ChangePasswordRequest request) {
        User user = userMapper.selectById(principal.getId());
        if (user == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "用户不存在");
        }
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "原密码错误");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userMapper.updateById(user);
        jwtTokenService.deleteAllRefreshTokens(user.getId());
        jwtTokenService.blacklistAccess(principal.getJti(), principal.getExp());
    }

    private LoginVO issueLogin(User user) {
        TokenPair pair = jwtTokenService.issueTokens(
                user.getId(), user.getUsername(), user.getRole(), user.getNickname());
        return new LoginVO(pair.accessToken(), jwtProperties.getAccessTtl().toSeconds(), "Bearer",
                pair.refreshToken(), UserVO.from(user));
    }

    private void checkLocked(String username) {
        if (Boolean.TRUE.equals(redisTemplate.hasKey(LOGIN_LOCK_PREFIX + username))) {
            throw new BusinessException(ErrorCode.LOGIN_LOCKED);
        }
    }

    private void onLoginFail(String username) {
        String counterKey = LOGIN_FAIL_PREFIX + username;
        Long count = redisTemplate.opsForValue().increment(counterKey);
        if (count != null && count == 1) {
            redisTemplate.expire(counterKey, loginFailProperties.getWindow());
        }
        if (count != null && count >= loginFailProperties.getThreshold()) {
            redisTemplate.opsForValue().set(
                    LOGIN_LOCK_PREFIX + username, "1", loginFailProperties.getLockDuration());
        }
    }

    private void onLoginSuccess(String username) {
        redisTemplate.delete(LOGIN_FAIL_PREFIX + username);
        redisTemplate.delete(LOGIN_LOCK_PREFIX + username);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
