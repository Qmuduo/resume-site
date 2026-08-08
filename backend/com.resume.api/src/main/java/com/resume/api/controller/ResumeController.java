package com.resume.api.controller;

import com.resume.api.common.Result;
import com.resume.api.dto.ResumeRequest;
import com.resume.api.entity.Resume;
import com.resume.api.service.ResumeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 简历 CRUD 接口。
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
    public Result<List<Resume>> list(HttpServletRequest request) {
        return Result.ok(resumeService.listByUser(currentUserId(request)));
    }

    @GetMapping("/{id}")
    public Result<Resume> get(@PathVariable Long id, HttpServletRequest request) {
        Resume resume = resumeService.getByUser(currentUserId(request), id);
        if (resume == null) {
            return Result.fail(404, "简历不存在或无权访问");
        }
        return Result.ok(resume);
    }

    @PostMapping
    public Result<Resume> create(@Valid @RequestBody ResumeRequest body, HttpServletRequest request) {
        return Result.ok(resumeService.create(currentUserId(request), body));
    }

    @PutMapping("/{id}")
    public Result<Resume> update(@PathVariable Long id,
                                 @Valid @RequestBody ResumeRequest body,
                                 HttpServletRequest request) {
        Resume resume = resumeService.update(currentUserId(request), id, body);
        if (resume == null) {
            return Result.fail(404, "简历不存在或无权访问");
        }
        return Result.ok(resume);
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, HttpServletRequest request) {
        if (!resumeService.delete(currentUserId(request), id)) {
            return Result.fail(404, "简历不存在或无权访问");
        }
        return Result.ok(null);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> handleIllegalArgument(IllegalArgumentException e) {
        return Result.fail(400, e.getMessage());
    }

    /**
     * JWT 鉴权占位：当前从拦截器拿固定 userId，接入真实 JWT 后改为从 token 解析。
     */
    private Long currentUserId(HttpServletRequest request) {
        Object userId = request.getAttribute("userId");
        if (userId instanceof Long) {
            return (Long) userId;
        }
        return 1L;
    }
}
