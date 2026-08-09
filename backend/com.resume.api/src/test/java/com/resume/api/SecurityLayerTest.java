package com.resume.api;

import com.resume.api.security.JwtTokenService;
import com.resume.api.service.AuthService;
import com.resume.api.service.UserService;
import com.resume.api.vo.LoginVO;
import com.resume.api.vo.UserVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 安全层集成测试：白名单、401/403、Result 包装、黑名单 token。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityLayerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    @MockBean
    private AuthService authService;

    @MockBean
    private UserService userService;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(org.mockito.Mockito.mock(ValueOperations.class));
    }

    @Test
    void protectedEndpoint_withoutToken_returns401Json() throws Exception {
        mockMvc.perform(get("/api/resumes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未登录或登录已过期"));
    }

    @Test
    void publicLoginEndpoint_reachableWithoutToken() throws Exception {
        LoginVO loginVO = new LoginVO("at", 1800L, "Bearer", "rt", new UserVO());
        when(authService.login(org.mockito.ArgumentMatchers.any())).thenReturn(loginVO);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alice\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.accessToken").value("at"));
    }

    @Test
    void me_withValidUserToken_returnsUser() throws Exception {
        JwtTokenService.TokenPair pair = jwtTokenService.issueTokens(1L, "alice", "USER", null);
        when(authService.me(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new UserVO(1L, "alice", null, null, "USER", null));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + pair.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value("alice"));
    }

    @Test
    void adminEndpoint_withUserRole_returns403() throws Exception {
        JwtTokenService.TokenPair pair = jwtTokenService.issueTokens(1L, "alice", "USER", null);

        mockMvc.perform(get("/api/v1/admin/users")
                        .header("Authorization", "Bearer " + pair.accessToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void adminEndpoint_withAdminRole_allowed() throws Exception {
        JwtTokenService.TokenPair pair = jwtTokenService.issueTokens(2L, "root", "ADMIN", "管理员");
        when(userService.listAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/users")
                        .header("Authorization", "Bearer " + pair.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void templatesEndpoint_publicWithoutToken() throws Exception {
        mockMvc.perform(get("/api/templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void blacklistedToken_rejectedWith401() throws Exception {
        JwtTokenService.TokenPair pair = jwtTokenService.issueTokens(1L, "alice", "USER", null);
        when(redisTemplate.hasKey("bl:" + pair.accessJti())).thenReturn(true);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + pair.accessToken()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void invalidToken_rejectedWith401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }
}
