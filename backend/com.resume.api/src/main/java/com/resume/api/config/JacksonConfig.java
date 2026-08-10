package com.resume.api.config;

import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Jackson 全局配置：将 Long 序列化为字符串。
 * <p>
 * Snowflake ID 为 18~19 位，超出 JS Number 最大安全整数 2^53-1，以数字下发会被前端截断，
 * 导致按 ID 查询时请求到不存在的记录。序列化为字符串可保证 ID 前后端一致往返。
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer longToStringCustomizer() {
        // 只注册 Long 的序列化器，避免 modules() 覆盖 Spring Boot 默认模块（JSR-310 日期等）
        return builder -> builder.serializerByType(Long.class, ToStringSerializer.instance);
    }
}
