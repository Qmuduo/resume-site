package com.resume.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 内置简历模板服务：从 classpath 的 resources/templates/*.json 读取。
 */
@Service
public class TemplateService {

    private static final Logger log = LoggerFactory.getLogger(TemplateService.class);

    private final List<Map<String, Object>> builtinTemplates;

    public TemplateService(ObjectMapper objectMapper,
                           @Value("classpath*:templates/template-*.json") Resource[] templateResources) {
        this.builtinTemplates = loadBuiltinTemplates(objectMapper, templateResources);
    }

    public List<Map<String, Object>> listBuiltinTemplates() {
        return builtinTemplates;
    }

    private static List<Map<String, Object>> loadBuiltinTemplates(ObjectMapper objectMapper,
                                                                  Resource[] templateResources) {
        List<Resource> sorted = Arrays.stream(templateResources)
                .sorted(Comparator.comparing(r -> r.getFilename() == null ? "" : r.getFilename()))
                .toList();
        List<Map<String, Object>> templates = new ArrayList<>();
        for (Resource resource : sorted) {
            try (InputStream in = resource.getInputStream()) {
                templates.add(objectMapper.readValue(in, new TypeReference<Map<String, Object>>() {
                }));
            } catch (IOException e) {
                log.warn("Skip invalid builtin template file: {}", resource.getFilename(), e);
            }
        }
        return List.copyOf(templates);
    }
}
