package com.resume.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 刷新 token 请求。
 */
public class RefreshRequest {

    @NotBlank(message = "refreshToken 不能为空")
    private String refreshToken;

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }
}
