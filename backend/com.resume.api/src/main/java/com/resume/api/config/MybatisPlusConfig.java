package com.resume.api.config;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 配置占位：repository 包下的 Mapper 由 MyBatis-Plus 托管。
 */
@Configuration
@MapperScan("com.resume.api.repository")
public class MybatisPlusConfig {
}
