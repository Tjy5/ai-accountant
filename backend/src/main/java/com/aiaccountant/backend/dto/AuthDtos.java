package com.aiaccountant.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {
    }

    public record RegisterRequest(
        @NotBlank(message = "邮箱和密码为必填项") @Email(message = "邮箱格式不正确") String email,
        @NotBlank(message = "邮箱和密码为必填项") @Size(min = 8, message = "密码长度至少为 8 位") String password,
        String name
    ) {
    }

    public record LoginRequest(
        @NotBlank(message = "邮箱和密码为必填项") String email,
        @NotBlank(message = "邮箱和密码为必填项") String password
    ) {
    }
}
