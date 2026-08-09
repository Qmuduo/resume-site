package com.resume.api.security;

import com.resume.api.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtTokenServiceTest {

    private static final String TEST_SECRET =
            "OJcWmzoTrqfPEU7VgEeqNTGrmLMNJ6zEkHKwh+I7S9sj7A+jU20Z/JsqVIVjdpEXP0Hr+TVpXQmtwx+4daPlDQ==";

    private StringRedisTemplate redisTemplate;
    private ValueOperations<String, String> valueOps;
    private JwtTokenService service;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret(TEST_SECRET);
        props.setAccessTtl(Duration.ofMinutes(30));
        props.setRefreshTtl(Duration.ofDays(7));
        redisTemplate = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        service = new JwtTokenService(props, redisTemplate);
    }

    @Test
    void issueTokens_parsesBackWithExpectedClaimsAndStoresRefresh() {
        JwtTokenService.TokenPair pair = service.issueTokens(42L, "alice", "ADMIN", "Alice");

        Claims access = service.parse(pair.accessToken());
        assertEquals("42", access.getSubject());
        assertEquals("alice", access.get("username", String.class));
        assertEquals("ADMIN", access.get("role", String.class));
        assertEquals("Alice", access.get("nickname", String.class));
        assertEquals(pair.accessJti(), access.getId());

        Claims refresh = service.parse(pair.refreshToken());
        assertEquals(pair.refreshJti(), refresh.getId());
        assertFalse(pair.accessToken().equals(pair.refreshToken()));
        assertNotNull(pair.accessExp());

        verify(valueOps).set(startsWith("rt:42:"), anyString(), eq(Duration.ofDays(7)));
    }

    @Test
    void parse_rejectsTamperedToken() {
        JwtTokenService.TokenPair pair = service.issueTokens(1L, "bob", "USER", null);
        assertThrows(JwtException.class, () -> service.parse(pair.accessToken() + "x"));
    }

    @Test
    void parse_rejectsExpiredToken() {
        String expired = service.buildToken(1L, "bob", "USER", null, "jti-expired",
                Instant.now().minus(Duration.ofMinutes(1)), Duration.ofSeconds(1));
        assertThrows(ExpiredJwtException.class, () -> service.parse(expired));
    }

    @Test
    void blacklistAccess_usesRemainingTtl() {
        Instant exp = Instant.now().plusSeconds(120);
        service.blacklistAccess("jti-1", exp);
        verify(valueOps).set(eq("bl:jti-1"), eq("1"),
                argThat(ttl -> ttl.getSeconds() > 0 && ttl.getSeconds() <= 120));
    }

    @Test
    void isBlacklisted_readsRedisFlag() {
        when(redisTemplate.hasKey("bl:jti-9")).thenReturn(true);
        assertTrue(service.isBlacklisted("jti-9"));
        assertFalse(service.isBlacklisted("jti-10"));
    }

    @Test
    void matchRefreshToken_comparesStoredValue() {
        when(valueOps.get("rt:7:abc")).thenReturn("tok");
        assertTrue(service.matchRefreshToken(7L, "abc", "tok"));
        assertFalse(service.matchRefreshToken(7L, "abc", "other"));
    }

    @Test
    void deleteAllRefreshTokens_deletesMatchingKeys() {
        when(redisTemplate.keys("rt:7:*")).thenReturn(Set.of("rt:7:a", "rt:7:b"));
        service.deleteAllRefreshTokens(7L);
        verify(redisTemplate).delete(Set.of("rt:7:a", "rt:7:b"));
    }
}
