package com.resume.api.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import com.resume.api.entity.User;
import com.resume.api.repository.UserMapper;
import com.resume.api.security.JwtTokenService;
import com.resume.api.vo.UserVO;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 用户管理服务（ADMIN）：用户列表、角色变更。
 */
@Service
public class UserService {

    private final UserMapper userMapper;
    private final JwtTokenService jwtTokenService;

    public UserService(UserMapper userMapper, JwtTokenService jwtTokenService) {
        this.userMapper = userMapper;
        this.jwtTokenService = jwtTokenService;
    }

    public List<UserVO> listAll() {
        return userMapper.selectList(Wrappers.<User>lambdaQuery().orderByAsc(User::getCreatedAt))
                .stream()
                .map(UserVO::from)
                .toList();
    }

    /**
     * 修改角色：禁止操作自己（防止唯一管理员被降权锁死），改后作废该用户全部 refreshToken。
     */
    public void updateRole(Long id, String role, Long operatorId) {
        if (id.equals(operatorId)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不能修改自己的角色");
        }
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        user.setRole(role);
        userMapper.updateById(user);
        jwtTokenService.deleteAllRefreshTokens(user.getId());
    }
}
