package com.resume.api.service;

import com.resume.api.common.exception.BusinessException;
import com.resume.api.entity.User;
import com.resume.api.repository.UserMapper;
import com.resume.api.security.JwtTokenService;
import com.resume.api.vo.UserVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceTest {

    private UserMapper userMapper;
    private JwtTokenService jwtTokenService;
    private UserService userService;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        jwtTokenService = mock(JwtTokenService.class);
        userService = new UserService(userMapper, jwtTokenService);
    }

    @Test
    void listAll_mapsEntitiesWithoutPassword() {
        User user = new User();
        user.setId(1L);
        user.setUsername("alice");
        user.setRole("ADMIN");
        when(userMapper.selectList(any())).thenReturn(List.of(user));

        List<UserVO> result = userService.listAll();

        assertEquals(1, result.size());
        assertEquals("alice", result.get(0).getUsername());
        assertEquals("ADMIN", result.get(0).getRole());
    }

    @Test
    void updateRole_selfOperation_rejected() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> userService.updateRole(1L, "ADMIN", 1L));
        assertEquals(400, e.getCode());
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void updateRole_missingUser_throws404() {
        when(userMapper.selectById(9L)).thenReturn(null);
        BusinessException e = assertThrows(BusinessException.class,
                () -> userService.updateRole(9L, "ADMIN", 1L));
        assertEquals(404, e.getCode());
    }

    @Test
    void updateRole_success_revokesTargetRefreshTokens() {
        User user = new User();
        user.setId(2L);
        user.setUsername("bob");
        user.setRole("USER");
        when(userMapper.selectById(2L)).thenReturn(user);

        userService.updateRole(2L, "ADMIN", 1L);

        assertEquals("ADMIN", user.getRole());
        verify(userMapper).updateById(user);
        verify(jwtTokenService).deleteAllRefreshTokens(2L);
    }
}
