package com.myqaweb.auth;

public interface AuthService {
    AuthDto.AuthResponse login(AuthDto.LoginRequest request);
    AuthDto.AuthResponse register(AuthDto.RegisterRequest request);
}
