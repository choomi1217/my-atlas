package com.myqaweb.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDto {

    public record LoginRequest(
            @NotBlank(message = "Username is required")
            String username,

            @NotBlank(message = "Password is required")
            String password
    ) {}

    public record RegisterRequest(
            @NotBlank(message = "Username is required")
            @Size(min = 2, max = 50, message = "Username must be 2-50 characters")
            String username,

            @NotBlank(message = "Password is required")
            @Size(min = 4, max = 100, message = "Password must be 4-100 characters")
            String password,

            Role role
    ) {}

    public record AuthResponse(
            String token,
            String username,
            Role role
    ) {}
}
