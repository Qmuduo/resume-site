package com.resume.api.vo;

import com.resume.api.entity.User;

import java.time.LocalDateTime;

/**
 * 用户视图对象：永不包含密码。
 */
public class UserVO {

    private Long id;
    private String username;
    private String nickname;
    private String email;
    private String role;
    private LocalDateTime createdAt;

    public UserVO() {
    }

    public UserVO(Long id, String username, String nickname, String email, String role, LocalDateTime createdAt) {
        this.id = id;
        this.username = username;
        this.nickname = nickname;
        this.email = email;
        this.role = role;
        this.createdAt = createdAt;
    }

    public static UserVO from(User user) {
        return new UserVO(user.getId(), user.getUsername(), user.getNickname(), user.getEmail(),
                user.getRole(), user.getCreatedAt());
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
