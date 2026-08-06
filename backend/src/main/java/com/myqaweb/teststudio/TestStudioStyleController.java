package com.myqaweb.teststudio;

import com.myqaweb.common.ApiResponse;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigRequest;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigResponse;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleRequest;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.CreateRequest;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.ProfileResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.RenameRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for Test Studio v2.5 스타일 세트/예시/보조 설정.
 * All responses wrapped in {@link ApiResponse}. Shares the {@code /api/test-studio} base path
 * with {@link TestStudioController} (no path collisions).
 */
@RestController
@RequestMapping("/api/test-studio")
@RequiredArgsConstructor
public class TestStudioStyleController {

    private final TestStudioStyleService service;

    // --- 스타일 세트 ---

    @GetMapping("/style-profiles")
    public ResponseEntity<ApiResponse<List<ProfileResponse>>> listProfiles(
            @RequestParam(value = "companyId", required = false) Long companyId) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required");
        }
        return ResponseEntity.ok(ApiResponse.ok(service.listProfiles(companyId)));
    }

    @PostMapping("/style-profiles")
    public ResponseEntity<ApiResponse<ProfileResponse>> createProfile(
            @Valid @RequestBody CreateRequest request) {
        ProfileResponse created = service.createProfile(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Style profile created", created));
    }

    @PutMapping("/style-profiles/{id}")
    public ResponseEntity<ApiResponse<ProfileResponse>> renameProfile(
            @PathVariable Long id, @Valid @RequestBody RenameRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(service.renameProfile(id, request)));
    }

    @DeleteMapping("/style-profiles/{id}")
    public ResponseEntity<Void> deleteProfile(@PathVariable Long id) {
        service.deleteProfile(id);
        return ResponseEntity.noContent().build();
    }

    // --- 세트 내 예시 TC ---

    @GetMapping("/style-profiles/{profileId}/examples")
    public ResponseEntity<ApiResponse<List<ExampleResponse>>> listExamples(
            @PathVariable Long profileId) {
        return ResponseEntity.ok(ApiResponse.ok(service.listExamples(profileId)));
    }

    @PostMapping("/style-profiles/{profileId}/examples")
    public ResponseEntity<ApiResponse<ExampleResponse>> addExample(
            @PathVariable Long profileId, @Valid @RequestBody ExampleRequest request) {
        ExampleResponse created = service.addExample(profileId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Style example created", created));
    }

    @PutMapping("/style-examples/{id}")
    public ResponseEntity<ApiResponse<ExampleResponse>> updateExample(
            @PathVariable Long id, @Valid @RequestBody ExampleRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(service.updateExample(id, request)));
    }

    @DeleteMapping("/style-examples/{id}")
    public ResponseEntity<Void> deleteExample(@PathVariable Long id) {
        service.deleteExample(id);
        return ResponseEntity.noContent().build();
    }

    // --- 보조 설정 + 활성 세트 ---

    @GetMapping("/config")
    public ResponseEntity<ApiResponse<ConfigResponse>> getConfig(
            @RequestParam(value = "companyId", required = false) Long companyId) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required");
        }
        return ResponseEntity.ok(ApiResponse.ok(service.getConfig(companyId)));
    }

    @PutMapping("/config")
    public ResponseEntity<ApiResponse<ConfigResponse>> upsertConfig(
            @Valid @RequestBody ConfigRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(service.upsertConfig(request)));
    }
}
