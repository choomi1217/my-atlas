package com.myqaweb.settings;

import com.myqaweb.auth.AppUserEntity;
import com.myqaweb.auth.AppUserRepository;
import com.myqaweb.auth.Role;
import com.myqaweb.feature.CompanyEntity;
import com.myqaweb.feature.CompanyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SettingsServiceImplTest {

    @Mock private SystemSettingsRepository settingsRepository;
    @Mock private UserCompanyAccessRepository userCompanyAccessRepository;
    @Mock private AppUserRepository appUserRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks
    private SettingsServiceImpl settingsService;

    private SystemSettingsEntity aiSetting;
    private SystemSettingsEntity timeoutSetting;
    private SystemSettingsEntity loginRequiredSetting;
    private SystemSettingsEntity rateLimitPerIpSetting;
    private SystemSettingsEntity rateLimitWindowSetting;

    @BeforeEach
    void setUp() {
        aiSetting = new SystemSettingsEntity(1L, "ai_enabled", "true", LocalDateTime.now());
        timeoutSetting = new SystemSettingsEntity(2L, "session_timeout_seconds", "3600", LocalDateTime.now());
        loginRequiredSetting = new SystemSettingsEntity(3L, "login_required", "true", LocalDateTime.now());
        rateLimitPerIpSetting = new SystemSettingsEntity(4L, "ai_rate_limit_per_ip", "30", LocalDateTime.now());
        rateLimitWindowSetting = new SystemSettingsEntity(5L, "ai_rate_limit_window_seconds", "3600", LocalDateTime.now());
    }

    // --- getSettings ---

    @Test
    void getSettings_returnsCurrentValues() {
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));

        SettingsDto.SystemSettingsResponse result = settingsService.getSettings();

        assertTrue(result.aiEnabled());
        assertEquals(3600, result.sessionTimeoutSeconds());
    }

    @Test
    void getSettings_returnsDefaultsWhenNotFound() {
        when(settingsRepository.findBySettingKey(any())).thenReturn(Optional.empty());

        SettingsDto.SystemSettingsResponse result = settingsService.getSettings();

        assertTrue(result.aiEnabled());
        assertEquals(3600, result.sessionTimeoutSeconds());
    }

    // --- updateSettings ---

    @Test
    void updateSettings_updatesAiEnabled() {
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));
        when(settingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SettingsDto.UpdateSettingsRequest request = new SettingsDto.UpdateSettingsRequest(false, null, null, null, null);
        settingsService.updateSettings(request);

        assertEquals("false", aiSetting.getSettingValue());
        verify(settingsRepository).save(aiSetting);
    }

    @Test
    void updateSettings_updatesSessionTimeout() {
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));
        when(settingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SettingsDto.UpdateSettingsRequest request = new SettingsDto.UpdateSettingsRequest(null, 600L, null, null, null);
        settingsService.updateSettings(request);

        assertEquals("600", timeoutSetting.getSettingValue());
        verify(settingsRepository).save(timeoutSetting);
    }

    // --- registerUser ---

    @Test
    void registerUser_createsUserWithCompanyAccess() {
        when(appUserRepository.existsByUsername("woowa")).thenReturn(false);
        when(passwordEncoder.encode("pass1234")).thenReturn("encoded");
        AppUserEntity saved = new AppUserEntity(2L, "woowa", "encoded", Role.USER, LocalDateTime.now());
        when(appUserRepository.save(any())).thenReturn(saved);
        when(userCompanyAccessRepository.findCompanyIdsByUserId(2L)).thenReturn(List.of(1L));

        CompanyEntity company = new CompanyEntity();
        company.setId(1L);
        company.setName("배달의민족");
        when(companyRepository.findAllById(List.of(1L))).thenReturn(List.of(company));

        SettingsDto.RegisterUserRequest request = new SettingsDto.RegisterUserRequest("woowa", "pass1234", List.of(1L));
        SettingsDto.UserWithCompaniesResponse result = settingsService.registerUser(request);

        assertEquals("woowa", result.username());
        assertEquals("USER", result.role());
        assertEquals(1, result.companies().size());
        assertEquals("배달의민족", result.companies().get(0).name());
        verify(userCompanyAccessRepository).save(any(UserCompanyAccessEntity.class));
    }

    @Test
    void registerUser_throwsWhenDuplicate() {
        when(appUserRepository.existsByUsername("admin")).thenReturn(true);

        SettingsDto.RegisterUserRequest request = new SettingsDto.RegisterUserRequest("admin", "pass", List.of(1L));

        assertThrows(IllegalArgumentException.class, () -> settingsService.registerUser(request));
        verify(appUserRepository, never()).save(any());
    }

    // --- deleteUser ---

    @Test
    void deleteUser_deletesNonAdminUser() {
        AppUserEntity user = new AppUserEntity(2L, "woowa", "encoded", Role.USER, LocalDateTime.now());
        when(appUserRepository.findById(2L)).thenReturn(Optional.of(user));

        settingsService.deleteUser(2L);

        verify(appUserRepository).delete(user);
    }

    @Test
    void deleteUser_throwsWhenAdminUser() {
        AppUserEntity admin = new AppUserEntity(1L, "admin", "encoded", Role.ADMIN, LocalDateTime.now());
        when(appUserRepository.findById(1L)).thenReturn(Optional.of(admin));

        assertThrows(IllegalArgumentException.class, () -> settingsService.deleteUser(1L));
        verify(appUserRepository, never()).delete(any());
    }

    // --- isAiEnabled / getSessionTimeoutSeconds ---

    @Test
    void isAiEnabled_returnsFalseWhenDisabled() {
        aiSetting.setSettingValue("false");
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));

        assertFalse(settingsService.isAiEnabled());
    }

    @Test
    void getSessionTimeoutSeconds_returnsConfiguredValue() {
        timeoutSetting.setSettingValue("600");
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));

        assertEquals(600, settingsService.getSessionTimeoutSeconds());
    }

    // --- updateUserCompanies ---

    // --- isLoginRequired ---

    @Test
    void isLoginRequired_returnsTrueWhenSettingIsTrue() {
        when(settingsRepository.findBySettingKey("login_required")).thenReturn(Optional.of(loginRequiredSetting));

        assertTrue(settingsService.isLoginRequired());
    }

    @Test
    void isLoginRequired_returnsFalseWhenSettingIsFalse() {
        loginRequiredSetting.setSettingValue("false");
        when(settingsRepository.findBySettingKey("login_required")).thenReturn(Optional.of(loginRequiredSetting));

        assertFalse(settingsService.isLoginRequired());
    }

    @Test
    void isLoginRequired_returnsDefaultTrueWhenMissing() {
        when(settingsRepository.findBySettingKey("login_required")).thenReturn(Optional.empty());

        assertTrue(settingsService.isLoginRequired(),
                "키가 없으면 기본값 true (안전한 방향으로 — 로그인 필요 유지)");
    }

    // --- getAiRateLimitPerIp ---

    @Test
    void getAiRateLimitPerIp_returnsConfiguredValue() {
        rateLimitPerIpSetting.setSettingValue("50");
        when(settingsRepository.findBySettingKey("ai_rate_limit_per_ip")).thenReturn(Optional.of(rateLimitPerIpSetting));

        assertEquals(50, settingsService.getAiRateLimitPerIp());
    }

    @Test
    void getAiRateLimitPerIp_returnsDefault30WhenMissing() {
        when(settingsRepository.findBySettingKey("ai_rate_limit_per_ip")).thenReturn(Optional.empty());

        assertEquals(30, settingsService.getAiRateLimitPerIp());
    }

    // --- getAiRateLimitWindowSeconds ---

    @Test
    void getAiRateLimitWindowSeconds_returnsConfiguredValue() {
        rateLimitWindowSetting.setSettingValue("7200");
        when(settingsRepository.findBySettingKey("ai_rate_limit_window_seconds"))
                .thenReturn(Optional.of(rateLimitWindowSetting));

        assertEquals(7200, settingsService.getAiRateLimitWindowSeconds());
    }

    @Test
    void getAiRateLimitWindowSeconds_returnsDefault3600WhenMissing() {
        when(settingsRepository.findBySettingKey("ai_rate_limit_window_seconds")).thenReturn(Optional.empty());

        assertEquals(3600, settingsService.getAiRateLimitWindowSeconds());
    }

    // --- getSettings: 신규 3필드 포함 ---

    @Test
    void getSettings_includesLoginRequiredAndRateLimitFields() {
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));
        loginRequiredSetting.setSettingValue("false");
        when(settingsRepository.findBySettingKey("login_required")).thenReturn(Optional.of(loginRequiredSetting));
        rateLimitPerIpSetting.setSettingValue("42");
        when(settingsRepository.findBySettingKey("ai_rate_limit_per_ip")).thenReturn(Optional.of(rateLimitPerIpSetting));
        rateLimitWindowSetting.setSettingValue("900");
        when(settingsRepository.findBySettingKey("ai_rate_limit_window_seconds"))
                .thenReturn(Optional.of(rateLimitWindowSetting));

        SettingsDto.SystemSettingsResponse result = settingsService.getSettings();

        assertTrue(result.aiEnabled());
        assertEquals(3600, result.sessionTimeoutSeconds());
        assertFalse(result.loginRequired());
        assertEquals(42, result.aiRateLimitPerIp());
        assertEquals(900, result.aiRateLimitWindowSeconds());
    }

    @Test
    void getSettings_returnsDefaultsForMissingRateLimitAndLoginKeys() {
        when(settingsRepository.findBySettingKey(any())).thenReturn(Optional.empty());

        SettingsDto.SystemSettingsResponse result = settingsService.getSettings();

        assertTrue(result.loginRequired(), "기본 loginRequired=true");
        assertEquals(30, result.aiRateLimitPerIp(), "기본 limit=30");
        assertEquals(3600, result.aiRateLimitWindowSeconds(), "기본 window=3600");
    }

    // --- updateSettings: 신규 필드 ---

    @Test
    void updateSettings_nullLoginRequired_doesNotUpdate() {
        when(settingsRepository.findBySettingKey(any())).thenReturn(Optional.empty());

        SettingsDto.UpdateSettingsRequest request =
                new SettingsDto.UpdateSettingsRequest(null, null, null, null, null);
        settingsService.updateSettings(request);

        verify(settingsRepository, never()).save(any());
    }

    @Test
    void updateSettings_updatesLoginRequiredToFalse_updatesExistingKey() {
        when(settingsRepository.findBySettingKey("login_required")).thenReturn(Optional.of(loginRequiredSetting));
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));
        when(settingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SettingsDto.UpdateSettingsRequest request =
                new SettingsDto.UpdateSettingsRequest(null, null, false, null, null);
        settingsService.updateSettings(request);

        assertEquals("false", loginRequiredSetting.getSettingValue());
        verify(settingsRepository).save(loginRequiredSetting);
    }

    @Test
    void updateSettings_insertsLoginRequiredWhenKeyMissing() {
        // getSettings에서 읽을 때와 upsert에서 읽을 때 모두 Optional.empty() 반환
        when(settingsRepository.findBySettingKey(any())).thenReturn(Optional.empty());
        when(settingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SettingsDto.UpdateSettingsRequest request =
                new SettingsDto.UpdateSettingsRequest(null, null, false, null, null);
        settingsService.updateSettings(request);

        verify(settingsRepository).save(argThat(e ->
                "login_required".equals(e.getSettingKey()) && "false".equals(e.getSettingValue())));
    }

    @Test
    void updateSettings_updatesAiRateLimitPerIp() {
        when(settingsRepository.findBySettingKey("ai_rate_limit_per_ip")).thenReturn(Optional.of(rateLimitPerIpSetting));
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));
        when(settingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SettingsDto.UpdateSettingsRequest request =
                new SettingsDto.UpdateSettingsRequest(null, null, null, 100, null);
        settingsService.updateSettings(request);

        assertEquals("100", rateLimitPerIpSetting.getSettingValue());
        verify(settingsRepository).save(rateLimitPerIpSetting);
    }

    @Test
    void updateSettings_updatesAiRateLimitWindowSeconds() {
        when(settingsRepository.findBySettingKey("ai_rate_limit_window_seconds"))
                .thenReturn(Optional.of(rateLimitWindowSetting));
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));
        when(settingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SettingsDto.UpdateSettingsRequest request =
                new SettingsDto.UpdateSettingsRequest(null, null, null, null, 1800);
        settingsService.updateSettings(request);

        assertEquals("1800", rateLimitWindowSetting.getSettingValue());
        verify(settingsRepository).save(rateLimitWindowSetting);
    }

    @Test
    void updateSettings_updatesMultipleFieldsAtOnce() {
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));
        when(settingsRepository.findBySettingKey("login_required")).thenReturn(Optional.of(loginRequiredSetting));
        when(settingsRepository.findBySettingKey("ai_rate_limit_per_ip")).thenReturn(Optional.of(rateLimitPerIpSetting));
        when(settingsRepository.findBySettingKey("ai_rate_limit_window_seconds"))
                .thenReturn(Optional.of(rateLimitWindowSetting));
        when(settingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SettingsDto.UpdateSettingsRequest request =
                new SettingsDto.UpdateSettingsRequest(false, 1200L, false, 50, 1200);
        settingsService.updateSettings(request);

        assertEquals("false", aiSetting.getSettingValue());
        assertEquals("1200", timeoutSetting.getSettingValue());
        assertEquals("false", loginRequiredSetting.getSettingValue());
        assertEquals("50", rateLimitPerIpSetting.getSettingValue());
        assertEquals("1200", rateLimitWindowSetting.getSettingValue());
        verify(settingsRepository, times(5)).save(any());
    }

    // --- updateUserCompanies ---

    @Test
    void updateUserCompanies_replacesExistingMappings() {
        AppUserEntity user = new AppUserEntity(2L, "woowa", "encoded", Role.USER, LocalDateTime.now());
        when(appUserRepository.findById(2L)).thenReturn(Optional.of(user));
        when(userCompanyAccessRepository.findCompanyIdsByUserId(2L)).thenReturn(List.of(1L, 3L));

        CompanyEntity c1 = new CompanyEntity(); c1.setId(1L); c1.setName("Company A");
        CompanyEntity c3 = new CompanyEntity(); c3.setId(3L); c3.setName("Company C");
        when(companyRepository.findAllById(List.of(1L, 3L))).thenReturn(List.of(c1, c3));

        SettingsDto.UpdateCompaniesRequest request = new SettingsDto.UpdateCompaniesRequest(List.of(1L, 3L));
        SettingsDto.UserWithCompaniesResponse result = settingsService.updateUserCompanies(2L, request);

        verify(userCompanyAccessRepository).deleteByUserId(2L);
        verify(userCompanyAccessRepository, times(2)).save(any(UserCompanyAccessEntity.class));
        assertEquals(2, result.companies().size());
    }
}
