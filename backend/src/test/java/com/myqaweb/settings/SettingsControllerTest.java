package com.myqaweb.settings;

import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SettingsController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class SettingsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SettingsService settingsService;

    // --- GET /api/settings ---

    @Test
    void getSettings_returnsOk() throws Exception {
        SettingsDto.SystemSettingsResponse settings = new SettingsDto.SystemSettingsResponse(true, 3600, true, 30, 3600);
        when(settingsService.getSettings()).thenReturn(settings);

        mockMvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.aiEnabled").value(true))
                .andExpect(jsonPath("$.data.sessionTimeoutSeconds").value(3600));

        verify(settingsService).getSettings();
    }

    @Test
    void getSettings_includesLoginRequiredAndRateLimitFields() throws Exception {
        SettingsDto.SystemSettingsResponse settings = new SettingsDto.SystemSettingsResponse(
                true, 3600, false, 42, 900);
        when(settingsService.getSettings()).thenReturn(settings);

        mockMvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginRequired").value(false))
                .andExpect(jsonPath("$.data.aiRateLimitPerIp").value(42))
                .andExpect(jsonPath("$.data.aiRateLimitWindowSeconds").value(900));
    }

    // --- GET /api/settings/public ---

    @Test
    void getPublicSettings_returnsLoginRequiredTrue() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(true);

        mockMvc.perform(get("/api/settings/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.loginRequired").value(true));

        verify(settingsService).isLoginRequired();
    }

    @Test
    void getPublicSettings_returnsLoginRequiredFalse() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);

        mockMvc.perform(get("/api/settings/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginRequired").value(false));

        verify(settingsService).isLoginRequired();
    }

    // --- PATCH /api/settings ---

    @Test
    void updateSettings_returnsOk() throws Exception {
        SettingsDto.SystemSettingsResponse updated = new SettingsDto.SystemSettingsResponse(false, 600, true, 30, 3600);
        when(settingsService.updateSettings(any())).thenReturn(updated);

        mockMvc.perform(patch("/api/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"aiEnabled": false, "sessionTimeoutSeconds": 600}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.aiEnabled").value(false))
                .andExpect(jsonPath("$.data.sessionTimeoutSeconds").value(600));

        verify(settingsService).updateSettings(any());
    }

    @Test
    void updateSettings_loginRequiredFalse_passesThroughToService() throws Exception {
        SettingsDto.SystemSettingsResponse updated =
                new SettingsDto.SystemSettingsResponse(true, 3600, false, 30, 3600);
        when(settingsService.updateSettings(any())).thenReturn(updated);

        mockMvc.perform(patch("/api/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginRequired": false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginRequired").value(false));

        verify(settingsService).updateSettings(argThat(req ->
                Boolean.FALSE.equals(req.loginRequired())
                        && req.aiEnabled() == null
                        && req.sessionTimeoutSeconds() == null));
    }

    @Test
    void updateSettings_aiRateLimit_passesThroughToService() throws Exception {
        SettingsDto.SystemSettingsResponse updated =
                new SettingsDto.SystemSettingsResponse(true, 3600, true, 100, 1800);
        when(settingsService.updateSettings(any())).thenReturn(updated);

        mockMvc.perform(patch("/api/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"aiRateLimitPerIp": 100, "aiRateLimitWindowSeconds": 1800}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.aiRateLimitPerIp").value(100))
                .andExpect(jsonPath("$.data.aiRateLimitWindowSeconds").value(1800));

        verify(settingsService).updateSettings(argThat(req ->
                req.aiRateLimitPerIp() != null && req.aiRateLimitPerIp() == 100
                        && req.aiRateLimitWindowSeconds() != null && req.aiRateLimitWindowSeconds() == 1800));
    }

    // --- GET /api/settings/users ---

    @Test
    void getUsers_returnsOk() throws Exception {
        List<SettingsDto.UserWithCompaniesResponse> users = List.of(
                new SettingsDto.UserWithCompaniesResponse(1L, "admin", "ADMIN", List.of(), LocalDateTime.now()),
                new SettingsDto.UserWithCompaniesResponse(2L, "woowa", "USER",
                        List.of(new SettingsDto.CompanyInfo(1L, "배달의민족")), LocalDateTime.now())
        );
        when(settingsService.getUsers()).thenReturn(users);

        mockMvc.perform(get("/api/settings/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[1].username").value("woowa"))
                .andExpect(jsonPath("$.data[1].companies[0].name").value("배달의민족"));

        verify(settingsService).getUsers();
    }

    // --- POST /api/settings/users ---

    @Test
    void registerUser_returns201() throws Exception {
        SettingsDto.UserWithCompaniesResponse user = new SettingsDto.UserWithCompaniesResponse(
                2L, "woowa", "USER",
                List.of(new SettingsDto.CompanyInfo(1L, "배달의민족")),
                LocalDateTime.now());
        when(settingsService.registerUser(any())).thenReturn(user);

        mockMvc.perform(post("/api/settings/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username": "woowa", "password": "pass1234", "companyIds": [1]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.username").value("woowa"))
                .andExpect(jsonPath("$.data.companies[0].name").value("배달의민족"));

        verify(settingsService).registerUser(any());
    }

    @Test
    void registerUser_returns400WhenUsernameBlank() throws Exception {
        mockMvc.perform(post("/api/settings/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username": "", "password": "pass1234", "companyIds": [1]}
                                """))
                .andExpect(status().isBadRequest());

        verify(settingsService, never()).registerUser(any());
    }

    // --- PUT /api/settings/users/{id}/companies ---

    @Test
    void updateUserCompanies_returnsOk() throws Exception {
        SettingsDto.UserWithCompaniesResponse user = new SettingsDto.UserWithCompaniesResponse(
                2L, "woowa", "USER",
                List.of(new SettingsDto.CompanyInfo(1L, "A"), new SettingsDto.CompanyInfo(3L, "C")),
                LocalDateTime.now());
        when(settingsService.updateUserCompanies(eq(2L), any())).thenReturn(user);

        mockMvc.perform(put("/api/settings/users/2/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyIds": [1, 3]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companies.length()").value(2));

        verify(settingsService).updateUserCompanies(eq(2L), any());
    }

    // --- DELETE /api/settings/users/{id} ---

    @Test
    void deleteUser_returnsOk() throws Exception {
        doNothing().when(settingsService).deleteUser(2L);

        mockMvc.perform(delete("/api/settings/users/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(settingsService).deleteUser(2L);
    }

    @Test
    void deleteUser_returns400WhenAdminUser() throws Exception {
        doThrow(new IllegalArgumentException("Cannot delete ADMIN user"))
                .when(settingsService).deleteUser(1L);

        mockMvc.perform(delete("/api/settings/users/1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
