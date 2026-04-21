package com.myqaweb.settings;

import com.myqaweb.auth.AppUserEntity;
import com.myqaweb.auth.AppUserRepository;
import com.myqaweb.auth.Role;
import com.myqaweb.feature.CompanyEntity;
import com.myqaweb.feature.CompanyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class SettingsServiceImpl implements SettingsService {

    private static final String KEY_AI_ENABLED = "ai_enabled";
    private static final String KEY_SESSION_TIMEOUT = "session_timeout_seconds";
    private static final String KEY_LOGIN_REQUIRED = "login_required";
    private static final String KEY_RATE_LIMIT_PER_IP = "ai_rate_limit_per_ip";
    private static final String KEY_RATE_LIMIT_WINDOW = "ai_rate_limit_window_seconds";

    private static final long DEFAULT_SESSION_TIMEOUT = 3600L;
    private static final int DEFAULT_RATE_LIMIT_PER_IP = 30;
    private static final int DEFAULT_RATE_LIMIT_WINDOW = 3600;

    private final SystemSettingsRepository settingsRepository;
    private final UserCompanyAccessRepository userCompanyAccessRepository;
    private final AppUserRepository appUserRepository;
    private final CompanyRepository companyRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public SettingsDto.SystemSettingsResponse getSettings() {
        boolean aiEnabled = getBooleanSetting(KEY_AI_ENABLED, true);
        long sessionTimeout = getLongSetting(KEY_SESSION_TIMEOUT, DEFAULT_SESSION_TIMEOUT);
        boolean loginRequired = getBooleanSetting(KEY_LOGIN_REQUIRED, true);
        int rateLimitPerIp = getIntSetting(KEY_RATE_LIMIT_PER_IP, DEFAULT_RATE_LIMIT_PER_IP);
        int rateLimitWindow = getIntSetting(KEY_RATE_LIMIT_WINDOW, DEFAULT_RATE_LIMIT_WINDOW);
        return new SettingsDto.SystemSettingsResponse(
                aiEnabled, sessionTimeout, loginRequired, rateLimitPerIp, rateLimitWindow);
    }

    @Override
    public SettingsDto.SystemSettingsResponse updateSettings(SettingsDto.UpdateSettingsRequest request) {
        if (request.aiEnabled() != null) {
            upsertSetting(KEY_AI_ENABLED, String.valueOf(request.aiEnabled()));
        }
        if (request.sessionTimeoutSeconds() != null) {
            upsertSetting(KEY_SESSION_TIMEOUT, String.valueOf(request.sessionTimeoutSeconds()));
        }
        if (request.loginRequired() != null) {
            upsertSetting(KEY_LOGIN_REQUIRED, String.valueOf(request.loginRequired()));
        }
        if (request.aiRateLimitPerIp() != null) {
            upsertSetting(KEY_RATE_LIMIT_PER_IP, String.valueOf(request.aiRateLimitPerIp()));
        }
        if (request.aiRateLimitWindowSeconds() != null) {
            upsertSetting(KEY_RATE_LIMIT_WINDOW, String.valueOf(request.aiRateLimitWindowSeconds()));
        }
        log.info("System settings updated: aiEnabled={}, sessionTimeout={}, loginRequired={}, rateLimitPerIp={}, rateLimitWindow={}",
                request.aiEnabled(), request.sessionTimeoutSeconds(),
                request.loginRequired(), request.aiRateLimitPerIp(), request.aiRateLimitWindowSeconds());
        return getSettings();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SettingsDto.UserWithCompaniesResponse> getUsers() {
        return appUserRepository.findAll().stream()
                .map(this::toUserWithCompanies)
                .toList();
    }

    @Override
    public SettingsDto.UserWithCompaniesResponse registerUser(SettingsDto.RegisterUserRequest request) {
        if (appUserRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username already exists: " + request.username());
        }

        AppUserEntity user = new AppUserEntity();
        user.setUsername(request.username());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.USER);
        user.setCreatedAt(LocalDateTime.now());
        AppUserEntity saved = appUserRepository.save(user);

        assignCompanies(saved.getId(), request.companyIds());
        log.info("User registered via settings: {} with {} companies",
                saved.getUsername(), request.companyIds().size());
        return toUserWithCompanies(saved);
    }

    @Override
    public SettingsDto.UserWithCompaniesResponse updateUserCompanies(Long userId, SettingsDto.UpdateCompaniesRequest request) {
        AppUserEntity user = appUserRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        userCompanyAccessRepository.deleteByUserId(userId);
        assignCompanies(userId, request.companyIds());
        log.info("Company access updated for user {}: {} companies",
                user.getUsername(), request.companyIds().size());
        return toUserWithCompanies(user);
    }

    @Override
    public void deleteUser(Long userId) {
        AppUserEntity user = appUserRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        if (user.getRole() == Role.ADMIN) {
            throw new IllegalArgumentException("Cannot delete ADMIN user");
        }
        appUserRepository.delete(user);
        log.info("User deleted: {}", user.getUsername());
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isAiEnabled() {
        return getBooleanSetting(KEY_AI_ENABLED, true);
    }

    @Override
    @Transactional(readOnly = true)
    public long getSessionTimeoutSeconds() {
        return getLongSetting(KEY_SESSION_TIMEOUT, DEFAULT_SESSION_TIMEOUT);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isLoginRequired() {
        return getBooleanSetting(KEY_LOGIN_REQUIRED, true);
    }

    @Override
    @Transactional(readOnly = true)
    public int getAiRateLimitPerIp() {
        return getIntSetting(KEY_RATE_LIMIT_PER_IP, DEFAULT_RATE_LIMIT_PER_IP);
    }

    @Override
    @Transactional(readOnly = true)
    public int getAiRateLimitWindowSeconds() {
        return getIntSetting(KEY_RATE_LIMIT_WINDOW, DEFAULT_RATE_LIMIT_WINDOW);
    }

    private void assignCompanies(Long userId, List<Long> companyIds) {
        for (Long companyId : companyIds) {
            UserCompanyAccessEntity access = new UserCompanyAccessEntity();
            access.setUserId(userId);
            access.setCompanyId(companyId);
            access.setCreatedAt(LocalDateTime.now());
            userCompanyAccessRepository.save(access);
        }
    }

    private SettingsDto.UserWithCompaniesResponse toUserWithCompanies(AppUserEntity user) {
        List<Long> companyIds = userCompanyAccessRepository.findCompanyIdsByUserId(user.getId());
        List<SettingsDto.CompanyInfo> companies = companyRepository.findAllById(companyIds).stream()
                .map(c -> new SettingsDto.CompanyInfo(c.getId(), c.getName()))
                .toList();
        return new SettingsDto.UserWithCompaniesResponse(
                user.getId(), user.getUsername(), user.getRole().name(),
                companies, user.getCreatedAt()
        );
    }

    private boolean getBooleanSetting(String key, boolean defaultValue) {
        return settingsRepository.findBySettingKey(key)
                .map(s -> Boolean.parseBoolean(s.getSettingValue()))
                .orElse(defaultValue);
    }

    private long getLongSetting(String key, long defaultValue) {
        return settingsRepository.findBySettingKey(key)
                .map(s -> Long.parseLong(s.getSettingValue()))
                .orElse(defaultValue);
    }

    private int getIntSetting(String key, int defaultValue) {
        return settingsRepository.findBySettingKey(key)
                .map(s -> Integer.parseInt(s.getSettingValue()))
                .orElse(defaultValue);
    }

    private void upsertSetting(String key, String value) {
        SystemSettingsEntity entity = settingsRepository.findBySettingKey(key)
                .orElseGet(() -> {
                    SystemSettingsEntity e = new SystemSettingsEntity();
                    e.setSettingKey(key);
                    return e;
                });
        entity.setSettingValue(value);
        entity.setUpdatedAt(LocalDateTime.now());
        settingsRepository.save(entity);
    }
}
