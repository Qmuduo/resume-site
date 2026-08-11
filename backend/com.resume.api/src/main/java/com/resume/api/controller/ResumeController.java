package com.resume.api.controller;

import com.resume.api.common.Result;
import com.resume.api.dto.ResumeRequest;
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
 * 简历 CRUD 接口：整份 ResumeData 单文档 + 标题/状态；切换模板只改 metadata.template，走 update。
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

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails user) {
        if (!resumeService.delete(user.getId(), id)) {
            return Result.fail(404, "简历不存在或无权限访问");
        }
        return Result.ok(null);
    }
}
