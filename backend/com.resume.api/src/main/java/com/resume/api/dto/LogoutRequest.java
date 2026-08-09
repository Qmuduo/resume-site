package com.resume.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 注销请求。
 */
public class LogoutRequest {

    @NotBlank(message = "refreshToken 不能为空")
    private String refreshToken;

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }
}
