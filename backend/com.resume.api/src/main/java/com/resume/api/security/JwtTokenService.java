package com.resume.api.security;

import com.resume.api.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Set;
import java.util.UUID;

/**
 * JWT 签发、解析与 Redis 侧黑名单 / refreshToken 管理。
 */
@Service
public class JwtTokenService {

    private static final String BLACKLIST_PREFIX = "bl:";
    private static final String REFRESH_PREFIX = "rt:";

    private final JwtProperties jwtProperties;
    private final StringRedisTemplate redisTemplate;
    private final SecretKey key;

    public JwtTokenService(JwtProperties jwtProperties, StringRedisTemplate redisTemplate) {
        this.jwtProperties = jwtProperties;
        this.redisTemplate = redisTemplate;
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtProperties.getSecret()));
    }

    /**
     * 签发 access/refresh 双 token，refreshToken 落 Redis（rt:{userId}:{jti}）。
     */
    public TokenPair issueTokens(Long userId, String username, String role, String nickname) {
        Instant now = Instant.now();
        String accessJti = UUID.randomUUID().toString();
        String refreshJti = UUID.randomUUID().toString();
        String accessToken = buildToken(userId, username, role, nickname, accessJti, now, jwtProperties.getAccessTtl());
        String refreshToken = buildToken(userId, username, role, nickname, refreshJti, now, jwtProperties.getRefreshTtl());
        redisTemplate.opsForValue().set(
                REFRESH_PREFIX + userId + ":" + refreshJti, refreshToken, jwtProperties.getRefreshTtl());
        return new TokenPair(accessToken, refreshToken, accessJti, refreshJti, now.plus(jwtProperties.getAccessTtl()));
    }

    /**
     * 验签 + 校验 issuer/过期时间，返回 claims。失败抛 JwtException。
     */
    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(jwtProperties.getIssuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isBlacklisted(String jti) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti));
    }

    /**
     * jti 加入黑名单，TTL 为该 access token 的剩余有效时长。
     */
    public void blacklistAccess(String jti, Instant accessExp) {
        Duration ttl = Duration.between(Instant.now(), accessExp);
        if (ttl.isZero() || ttl.isNegative()) {
            ttl = Duration.ofSeconds(1);
        }
        redisTemplate.opsForValue().set(BLACKLIST_PREFIX + jti, "1", ttl);
    }

    public boolean matchRefreshToken(Long userId, String jti, String token) {
        String stored = redisTemplate.opsForValue().get(REFRESH_PREFIX + userId + ":" + jti);
        return token.equals(stored);
    }

    public void deleteRefreshToken(Long userId, String jti) {
        redisTemplate.delete(REFRESH_PREFIX + userId + ":" + jti);
    }

    /**
     * 删除某用户全部 refreshToken（改密、角色变更时强制全端下线）。
     */
    public void deleteAllRefreshTokens(Long userId) {
        Set<String> keys = redisTemplate.keys(REFRESH_PREFIX + userId + ":*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    String buildToken(Long userId, String username, String role, String nickname,
                      String jti, Instant now, Duration ttl) {
        return Jwts.builder()
                .issuer(jwtProperties.getIssuer())
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("role", role)
                .claim("nickname", nickname)
                .id(jti)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public record TokenPair(String accessToken, String refreshToken, String accessJti, String refreshJti,
                            Instant accessExp) {
    }
}
