package com.resume.api.service;

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
import com.resume.api.vo.LoginVO;
import com.resume.api.vo.UserVO;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private JwtTokenService jwtTokenService;
    private StringRedisTemplate redisTemplate;
    private ValueOperations<String, String> valueOps;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenService = mock(JwtTokenService.class);
        redisTemplate = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        JwtProperties jwtProps = new JwtProperties();
        jwtProps.setAccessTtl(Duration.ofMinutes(30));
        jwtProps.setRefreshTtl(Duration.ofDays(7));
        authService = new AuthService(userMapper, passwordEncoder, jwtTokenService,
                redisTemplate, jwtProps, new LoginFailProperties());
    }

    @Test
    void register_success_encodesPasswordAndDefaultsRole() {
        when(userMapper.selectCount(any())).thenReturn(0L);
        when(passwordEncoder.encode("secret123")).thenReturn("$2a$10$hash");

        UserVO result = authService.register(request("alice", "secret123"));

        assertEquals("alice", result.getUsername());
        assertEquals("USER", result.getRole());
        verify(userMapper).insert(any(User.class));
        verify(passwordEncoder).encode("secret123");
    }

    @Test
    void register_duplicateUsername_throws409() {
        when(userMapper.selectCount(any())).thenReturn(1L);
        BusinessException e = assertThrows(BusinessException.class,
                () -> authService.register(request("alice", "secret123")));
        assertEquals(409, e.getCode());
        verify(userMapper, never()).insert(any(User.class));
    }

    @Test
    void login_success_issuesTokensAndClearsLimitKeys() {
        User user = user(1L, "alice", "USER", "encoded");
        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("secret123", "encoded")).thenReturn(true);
        when(jwtTokenService.issueTokens(1L, "alice", "USER", null))
                .thenReturn(new JwtTokenService.TokenPair("at", "rt", "ajti", "rjti",
                        Instant.now().plusSeconds(1800)));

        LoginVO result = authService.login(login("alice", "secret123"));

        assertEquals("at", result.getAccessToken());
        assertEquals("rt", result.getRefreshToken());
        assertEquals("Bearer", result.getTokenType());
        assertEquals(1800L, result.getExpiresIn());
        verify(redisTemplate).delete("login_fail:alice");
        verify(redisTemplate).delete("login_lock:alice");
    }

    @Test
    void login_wrongPassword_countsFailAndThrows401() {
        when(userMapper.selectOne(any())).thenReturn(user(1L, "alice", "USER", "encoded"));
        when(passwordEncoder.matches("wrong", "encoded")).thenReturn(false);
        when(valueOps.increment("login_fail:alice")).thenReturn(1L);

        BusinessException e = assertThrows(BusinessException.class,
                () -> authService.login(login("alice", "wrong")));

        assertEquals(401, e.getCode());
        verify(valueOps).increment("login_fail:alice");
        verify(redisTemplate).expire(eq("login_fail:alice"), eq(Duration.ofMinutes(10)));
    }

    @Test
    void login_reachingThreshold_locksAccount() {
        when(userMapper.selectOne(any())).thenReturn(user(1L, "alice", "USER", "encoded"));
        when(passwordEncoder.matches("wrong", "encoded")).thenReturn(false);
        when(valueOps.increment("login_fail:alice")).thenReturn(5L);

        assertThrows(BusinessException.class, () -> authService.login(login("alice", "wrong")));

        verify(valueOps).set(eq("login_lock:alice"), eq("1"), eq(Duration.ofMinutes(15)));
    }

    @Test
    void login_lockedAccount_skipsPasswordCheck() {
        when(redisTemplate.hasKey("login_lock:alice")).thenReturn(true);
        assertThrows(BusinessException.class, () -> authService.login(login("alice", "secret123")));
        verify(userMapper, never()).selectOne(any());
    }

    @Test
    void refresh_success_rotatesAndRevokesOld() {
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn("1");
        when(claims.getId()).thenReturn("old-jti");
        when(jwtTokenService.parse("old-rt")).thenReturn(claims);
        when(jwtTokenService.matchRefreshToken(1L, "old-jti", "old-rt")).thenReturn(true);
        when(userMapper.selectById(1L)).thenReturn(user(1L, "alice", "USER", "encoded"));
        when(jwtTokenService.issueTokens(1L, "alice", "USER", null))
                .thenReturn(new JwtTokenService.TokenPair("new-at", "new-rt", "ajti", "rjti",
                        Instant.now().plusSeconds(1800)));

        LoginVO result = authService.refresh(new RefreshRequest() {{
            setRefreshToken("old-rt");
        }});

        assertEquals("new-at", result.getAccessToken());
        verify(jwtTokenService).deleteRefreshToken(1L, "old-jti");
    }

    @Test
    void refresh_rejectedWhenRedisMismatch() {
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn("1");
        when(claims.getId()).thenReturn("old-jti");
        when(jwtTokenService.parse("old-rt")).thenReturn(claims);
        when(jwtTokenService.matchRefreshToken(1L, "old-jti", "old-rt")).thenReturn(false);

        RefreshRequest request = new RefreshRequest();
        request.setRefreshToken("old-rt");
        BusinessException e = assertThrows(BusinessException.class, () -> authService.refresh(request));
        assertEquals(401, e.getCode());
        verify(jwtTokenService, never()).deleteRefreshToken(any(), anyString());
    }

    @Test
    void logout_blacklistsAccessAndDeletesRefresh() {
        CustomUserDetails principal = principal("acc-jti");
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn("1");
        when(claims.getId()).thenReturn("rt-jti");
        when(jwtTokenService.parse("rt-token")).thenReturn(claims);

        LogoutRequest request = new LogoutRequest();
        request.setRefreshToken("rt-token");
        authService.logout(principal, request);

        verify(jwtTokenService).blacklistAccess("acc-jti", principal.getExp());
        verify(jwtTokenService).deleteRefreshToken(1L, "rt-jti");
    }

    @Test
    void logout_toleratesInvalidRefreshToken() {
        CustomUserDetails p = principal("acc-jti");
        when(jwtTokenService.parse("bad-rt")).thenThrow(new JwtException("invalid"));
        LogoutRequest request = new LogoutRequest();
        request.setRefreshToken("bad-rt");

        authService.logout(p, request);

        verify(jwtTokenService).blacklistAccess("acc-jti", p.getExp());
        verify(jwtTokenService, never()).deleteRefreshToken(any(), anyString());
    }

    @Test
    void changePassword_wrongOldPassword_throws400() {
        when(userMapper.selectById(1L)).thenReturn(user(1L, "alice", "USER", "encoded"));
        when(passwordEncoder.matches("wrong-old", "encoded")).thenReturn(false);

        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setOldPassword("wrong-old");
        request.setNewPassword("new-secret");
        BusinessException e = assertThrows(BusinessException.class,
                () -> authService.changePassword(principal("acc-jti"), request));
        assertEquals(400, e.getCode());
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void changePassword_success_revokesAllSessions() {
        CustomUserDetails p = principal("acc-jti");
        User user = user(1L, "alice", "USER", "encoded");
        when(userMapper.selectById(1L)).thenReturn(user);
        when(passwordEncoder.matches("old", "encoded")).thenReturn(true);
        when(passwordEncoder.encode("new-secret")).thenReturn("new-hash");

        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setOldPassword("old");
        request.setNewPassword("new-secret");
        authService.changePassword(p, request);

        verify(userMapper).updateById(user);
        verify(jwtTokenService).deleteAllRefreshTokens(1L);
        verify(jwtTokenService).blacklistAccess("acc-jti", p.getExp());
    }

    private static RegisterRequest request(String username, String password) {
        RegisterRequest request = new RegisterRequest();
        request.setUsername(username);
        request.setPassword(password);
        return request;
    }

    private static LoginRequest login(String username, String password) {
        LoginRequest request = new LoginRequest();
        request.setUsername(username);
        request.setPassword(password);
        return request;
    }

    private static User user(Long id, String username, String role, String password) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setRole(role);
        user.setPassword(password);
        return user;
    }

    private static CustomUserDetails principal(String jti) {
        return new CustomUserDetails(1L, "alice", null, "USER", jti, Instant.now().plusSeconds(1800));
    }
}
