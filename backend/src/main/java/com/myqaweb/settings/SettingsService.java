package com.myqaweb.settings;

import java.util.List;

public interface SettingsService {

    SettingsDto.SystemSettingsResponse getSettings();

    SettingsDto.SystemSettingsResponse updateSettings(SettingsDto.UpdateSettingsRequest request);

    List<SettingsDto.UserWithCompaniesResponse> getUsers();

    SettingsDto.UserWithCompaniesResponse registerUser(SettingsDto.RegisterUserRequest request);

    SettingsDto.UserWithCompaniesResponse updateUserCompanies(Long userId, SettingsDto.UpdateCompaniesRequest request);

    void deleteUser(Long userId);

    boolean isAiEnabled();

    long getSessionTimeoutSeconds();

    boolean isLoginRequired();

    int getAiRateLimitPerIp();

    int getAiRateLimitWindowSeconds();
}
