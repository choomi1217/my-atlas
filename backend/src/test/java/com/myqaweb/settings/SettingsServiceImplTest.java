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

    @BeforeEach
    void setUp() {
        aiSetting = new SystemSettingsEntity(1L, "ai_enabled", "true", LocalDateTime.now());
        timeoutSetting = new SystemSettingsEntity(2L, "session_timeout_seconds", "3600", LocalDateTime.now());
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

        SettingsDto.UpdateSettingsRequest request = new SettingsDto.UpdateSettingsRequest(false, null);
        settingsService.updateSettings(request);

        assertEquals("false", aiSetting.getSettingValue());
        verify(settingsRepository).save(aiSetting);
    }

    @Test
    void updateSettings_updatesSessionTimeout() {
        when(settingsRepository.findBySettingKey("ai_enabled")).thenReturn(Optional.of(aiSetting));
        when(settingsRepository.findBySettingKey("session_timeout_seconds")).thenReturn(Optional.of(timeoutSetting));
        when(settingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SettingsDto.UpdateSettingsRequest request = new SettingsDto.UpdateSettingsRequest(null, 600L);
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
