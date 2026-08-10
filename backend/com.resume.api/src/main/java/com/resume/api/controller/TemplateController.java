package com.resume.api.controller;

import com.resume.api.common.Result;
import com.resume.api.dto.TemplateRequest;
import com.resume.api.security.CustomUserDetails;
import com.resume.api.service.TemplateService;
import com.resume.api.vo.TemplateVO;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 模板接口：列表公开（匿名只含内置模板），创建/修改/删除需登录且只能操作自己的自定义模板。
 */
@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public Result<List<TemplateVO>> list(@AuthenticationPrincipal CustomUserDetails user) {
        return Result.ok(templateService.list(user == null ? null : user.getId()));
    }

    @PostMapping
    public Result<TemplateVO> create(@AuthenticationPrincipal CustomUserDetails user,
                                     @Valid @RequestBody TemplateRequest body) {
        return Result.ok(templateService.create(user.getId(), body));
    }

    @PutMapping("/{id}")
    public Result<TemplateVO> update(@PathVariable Long id,
                                     @AuthenticationPrincipal CustomUserDetails user,
                                     @Valid @RequestBody TemplateRequest body) {
        return Result.ok(templateService.update(user.getId(), id, body, isAdmin(user)));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id,
                               @AuthenticationPrincipal CustomUserDetails user) {
        templateService.delete(user.getId(), id, isAdmin(user));
        return Result.ok(null);
    }

    private static boolean isAdmin(CustomUserDetails user) {
        return user != null && "ADMIN".equals(user.getRole());
    }
}
