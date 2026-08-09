package com.resume.api.common.exception;

/**
 * 业务错误码：与 HTTP 状态码一致，通过 Result.code 返回。
 */
public enum ErrorCode {

    BAD_REQUEST(400, "参数错误"),
    UNAUTHORIZED(401, "未登录或登录已过期"),
    FORBIDDEN(403, "无权限访问"),
    NOT_FOUND(404, "资源不存在"),
    USERNAME_TAKEN(409, "用户名已存在"),
    LOGIN_LOCKED(429, "登录失败次数过多，请稍后再试"),
    INTERNAL_ERROR(500, "系统繁忙，请稍后再试");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
