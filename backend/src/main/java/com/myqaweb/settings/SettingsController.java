package com.myqaweb.settings;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping
    public ResponseEntity<ApiResponse<SettingsDto.SystemSettingsResponse>> getSettings() {
        SettingsDto.SystemSettingsResponse settings = settingsService.getSettings();
        return ResponseEntity.ok(ApiResponse.ok(settings));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<SettingsDto.SystemSettingsResponse>> updateSettings(
            @Valid @RequestBody SettingsDto.UpdateSettingsRequest request) {
        SettingsDto.SystemSettingsResponse settings = settingsService.updateSettings(request);
        return ResponseEntity.ok(ApiResponse.ok("Settings updated", settings));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<SettingsDto.UserWithCompaniesResponse>>> getUsers() {
        List<SettingsDto.UserWithCompaniesResponse> users = settingsService.getUsers();
        return ResponseEntity.ok(ApiResponse.ok(users));
    }

    @PostMapping("/users")
    public ResponseEntity<ApiResponse<SettingsDto.UserWithCompaniesResponse>> registerUser(
            @Valid @RequestBody SettingsDto.RegisterUserRequest request) {
        SettingsDto.UserWithCompaniesResponse user = settingsService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("User registered", user));
    }

    @PutMapping("/users/{userId}/companies")
    public ResponseEntity<ApiResponse<SettingsDto.UserWithCompaniesResponse>> updateUserCompanies(
            @PathVariable Long userId,
            @Valid @RequestBody SettingsDto.UpdateCompaniesRequest request) {
        SettingsDto.UserWithCompaniesResponse user = settingsService.updateUserCompanies(userId, request);
        return ResponseEntity.ok(ApiResponse.ok("Company access updated", user));
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Long userId) {
        settingsService.deleteUser(userId);
        return ResponseEntity.ok(new ApiResponse<>(true, "User deleted", null));
    }
}
