package com.myqaweb.auth;

import com.myqaweb.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final SettingsService settingsService;

    @Override
    public AuthDto.AuthResponse login(AuthDto.LoginRequest request) {
        AppUserEntity user = appUserRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        String token = jwtProvider.generateToken(user.getUsername(), user.getRole());
        long sessionTimeout = settingsService.getSessionTimeoutSeconds();
        log.info("User logged in: {}", user.getUsername());
        return new AuthDto.AuthResponse(token, user.getUsername(), user.getRole(), sessionTimeout);
    }

    @Override
    public AuthDto.AuthResponse register(AuthDto.RegisterRequest request) {
        if (appUserRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username already exists: " + request.username());
        }

        Role role = request.role() != null ? request.role() : Role.USER;

        AppUserEntity entity = new AppUserEntity();
        entity.setUsername(request.username());
        entity.setPassword(passwordEncoder.encode(request.password()));
        entity.setRole(role);

        AppUserEntity saved = appUserRepository.save(entity);
        String token = jwtProvider.generateToken(saved.getUsername(), saved.getRole());
        long sessionTimeout = settingsService.getSessionTimeoutSeconds();
        log.info("User registered: {} with role {}", saved.getUsername(), saved.getRole());
        return new AuthDto.AuthResponse(token, saved.getUsername(), saved.getRole(), sessionTimeout);
    }
}
