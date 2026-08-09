package com.resume.api.config;

import io.jsonwebtoken.io.Decoders;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * JWT 配置。secret 生产环境走环境变量 JWT_SECRET，缺失时启动直接失败。
 */
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties implements InitializingBean {

    private String secret;
    private Duration accessTtl = Duration.ofMinutes(30);
    private Duration refreshTtl = Duration.ofDays(7);
    private String issuer = "resume-api";

    @Override
    public void afterPropertiesSet() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("jwt.secret 未配置，请设置环境变量 JWT_SECRET（openssl rand -base64 64 生成）");
        }
        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(secret);
        } catch (RuntimeException e) {
            throw new IllegalStateException("jwt.secret 不是合法的 base64", e);
        }
        if (keyBytes.length < 32) {
            throw new IllegalStateException("jwt.secret 解码后至少需要 32 字节（HS256），建议使用 openssl rand -base64 64");
        }
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public Duration getAccessTtl() {
        return accessTtl;
    }

    public void setAccessTtl(Duration accessTtl) {
        this.accessTtl = accessTtl;
    }

    public Duration getRefreshTtl() {
        return refreshTtl;
    }

    public void setRefreshTtl(Duration refreshTtl) {
        this.refreshTtl = refreshTtl;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }
}
