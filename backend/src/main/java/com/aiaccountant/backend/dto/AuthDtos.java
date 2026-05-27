package com.aiaccountant.backend.dto;

import jakarta.validation.constraints.NotBlank;

public final class AuthDtos {
    private AuthDtos() {
    }

    public record RegisterRequest(
        @NotBlank(message = "账号和密码为必填项") String email,
        @NotBlank(message = "账号和密码为必填项") String password,
        String name
    ) {
    }

    public record LoginRequest(
        @NotBlank(message = "账号和密码为必填项") String email,
        @NotBlank(message = "账号和密码为必填项") String password
    ) {
    }
}
