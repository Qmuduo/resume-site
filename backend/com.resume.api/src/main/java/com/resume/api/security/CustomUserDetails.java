package com.resume.api.security;

import java.time.Instant;

/**
 * 从 JWT claims 直接构造的当前用户信息（不查库）。
 */
public class CustomUserDetails {

    private final Long id;
    private final String username;
    private final String nickname;
    private final String role;
    private final String jti;
    private final Instant exp;

    public CustomUserDetails(Long id, String username, String nickname, String role, String jti, Instant exp) {
        this.id = id;
        this.username = username;
        this.nickname = nickname;
        this.role = role;
        this.jti = jti;
        this.exp = exp;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getNickname() {
        return nickname;
    }

    public String getRole() {
        return role;
    }

    public String getJti() {
        return jti;
    }

    public Instant getExp() {
        return exp;
    }
}
