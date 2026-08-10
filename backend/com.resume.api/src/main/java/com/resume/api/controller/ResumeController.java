package com.resume.api.controller;

import com.resume.api.common.Result;
import com.resume.api.dto.ResumeRequest;
import com.resume.api.dto.SwitchTemplateRequest;
import com.resume.api.entity.Resume;
import com.resume.api.security.CustomUserDetails;
import com.resume.api.service.ResumeService;
import com.resume.api.vo.ResumeVO;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
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
 * 简历 CRUD 接口：公共数据 / 扩展数据 / 当前模板ID 三参数，切换模板走独立接口。
 */
@RestController
@RequestMapping("/api/resumes")
@Validated
public class ResumeController {

    private final ResumeService resumeService;

    public ResumeController(ResumeService resumeService) {
        this.resumeService = resumeService;
    }

    @GetMapping
    public Result<List<Resume>> list(@AuthenticationPrincipal CustomUserDetails user) {
        return Result.ok(resumeService.listByUser(user.getId()));
    }

    @GetMapping("/{id}")
    public Result<ResumeVO> get(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails user) {
        Resume resume = resumeService.getByUser(user.getId(), id);
        if (resume == null) {
            return Result.fail(404, "简历不存在或无权限访问");
        }
        return Result.ok(resumeService.toVO(resume));
    }

    @PostMapping
    public Result<ResumeVO> create(@Valid @RequestBody ResumeRequest body,
                                   @AuthenticationPrincipal CustomUserDetails user) {
        return Result.ok(resumeService.toVO(resumeService.create(user.getId(), body)));
    }

    @PutMapping("/{id}")
    public Result<ResumeVO> update(@PathVariable Long id,
                                   @Valid @RequestBody ResumeRequest body,
                                   @AuthenticationPrincipal CustomUserDetails user) {
        Resume resume = resumeService.update(user.getId(), id, body);
        if (resume == null) {
            return Result.fail(404, "简历不存在或无权限访问");
        }
        return Result.ok(resumeService.toVO(resume));
    }

    /**
     * 切换模板：公共数据不变，专属字段按 manifest 尽量迁移，无法映射的暂存保留。
     */
    @PostMapping("/{id}/switch-template")
    public Result<ResumeVO> switchTemplate(@PathVariable Long id,
                                           @Valid @RequestBody SwitchTemplateRequest body,
                                           @AuthenticationPrincipal CustomUserDetails user) {
        Resume resume = resumeService.switchTemplate(user.getId(), id, body.getNewTemplateId());
        if (resume == null) {
            return Result.fail(404, "简历不存在或无权限访问");
        }
        return Result.ok(resumeService.toVO(resume));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails user) {
        if (!resumeService.delete(user.getId(), id)) {
            return Result.fail(404, "简历不存在或无权限访问");
        }
        return Result.ok(null);
    }
}
