package com.resume.api.controller;

import com.resume.api.common.Result;
import com.resume.api.dto.UpdateRoleRequest;
import com.resume.api.security.CustomUserDetails;
import com.resume.api.service.UserService;
import com.resume.api.vo.UserVO;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 管理员用户管理接口：仅 ADMIN 可访问。
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserService userService;

    public AdminUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public Result<List<UserVO>> list() {
        return Result.ok(userService.listAll());
    }

    @PutMapping("/{id}/role")
    public Result<Void> updateRole(@PathVariable Long id,
                                   @AuthenticationPrincipal CustomUserDetails principal,
                                   @Valid @RequestBody UpdateRoleRequest request) {
        userService.updateRole(id, request.getRole(), principal.getId());
        return Result.ok(null);
    }
}
