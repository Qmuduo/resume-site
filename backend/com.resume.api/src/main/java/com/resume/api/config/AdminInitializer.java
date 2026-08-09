package com.resume.api.config;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.resume.api.entity.User;
import com.resume.api.repository.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 管理员种子：同时设置 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量时创建对应管理员，否则跳过。
 */
@Component
public class AdminInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public AdminInitializer(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        String username = System.getenv("ADMIN_USERNAME");
        String password = System.getenv("ADMIN_PASSWORD");
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            log.warn("ADMIN_USERNAME / ADMIN_PASSWORD 未设置，跳过管理员种子初始化");
            return;
        }
        User existing = userMapper.selectOne(
                Wrappers.<User>lambdaQuery().eq(User::getUsername, username));
        if (existing == null) {
            User admin = new User();
            admin.setUsername(username);
            admin.setPassword(passwordEncoder.encode(password));
            admin.setNickname("管理员");
            admin.setRole("ADMIN");
            userMapper.insert(admin);
            log.info("admin user initialized: {}", username);
        } else {
            log.info("admin user already exists, skip: {}", username);
        }
    }
}
