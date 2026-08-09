package com.resume.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * 登录失败限频配置：窗口内失败 threshold 次后锁定 lockDuration。
 */
@ConfigurationProperties(prefix = "security.login-fail")
public class LoginFailProperties {

    private Duration window = Duration.ofMinutes(10);
    private int threshold = 5;
    private Duration lockDuration = Duration.ofMinutes(15);

    public Duration getWindow() {
        return window;
    }

    public void setWindow(Duration window) {
        this.window = window;
    }

    public int getThreshold() {
        return threshold;
    }

    public void setThreshold(int threshold) {
        this.threshold = threshold;
    }

    public Duration getLockDuration() {
        return lockDuration;
    }

    public void setLockDuration(Duration lockDuration) {
        this.lockDuration = lockDuration;
    }
}
