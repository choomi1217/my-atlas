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

    private final SystemSettingsRepository settingsRepository;
    private final UserCompanyAccessRepository userCompanyAccessRepository;
    private final AppUserRepository appUserRepository;
    private final CompanyRepository companyRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public SettingsDto.SystemSettingsResponse getSettings() {
        boolean aiEnabled = getBooleanSetting("ai_enabled", true);
        long sessionTimeout = getLongSetting("session_timeout_seconds", 3600);
        return new SettingsDto.SystemSettingsResponse(aiEnabled, sessionTimeout);
    }

    @Override
    public SettingsDto.SystemSettingsResponse updateSettings(SettingsDto.UpdateSettingsRequest request) {
        if (request.aiEnabled() != null) {
            upsertSetting("ai_enabled", String.valueOf(request.aiEnabled()));
        }
        if (request.sessionTimeoutSeconds() != null) {
            upsertSetting("session_timeout_seconds", String.valueOf(request.sessionTimeoutSeconds()));
        }
        log.info("System settings updated: aiEnabled={}, sessionTimeout={}",
                request.aiEnabled(), request.sessionTimeoutSeconds());
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
        return getBooleanSetting("ai_enabled", true);
    }

    @Override
    @Transactional(readOnly = true)
    public long getSessionTimeoutSeconds() {
        return getLongSetting("session_timeout_seconds", 3600);
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
