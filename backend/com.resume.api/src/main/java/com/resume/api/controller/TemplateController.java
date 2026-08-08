package com.resume.api.controller;

import com.resume.api.common.Result;
import com.resume.api.service.TemplateService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 简历模板接口。
 */
@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public Result<List<Map<String, Object>>> list() {
        return Result.ok(templateService.listBuiltinTemplates());
    }
}
