package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Version endpoints.
 */
@RestController
@RequestMapping("/api")
@Slf4j
public class VersionController {
    private final VersionService versionService;

    public VersionController(VersionService versionService) {
        this.versionService = versionService;
    }

    @GetMapping("/products/{productId}/versions")
    public ResponseEntity<ApiResponse<List<VersionDto.VersionSummary>>> getAllByProductId(@PathVariable Long productId) {
        List<VersionDto.VersionSummary> versions = versionService.getAllByProductId(productId);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Versions retrieved", versions)
        );
    }

    @GetMapping("/versions/{id}")
    public ResponseEntity<ApiResponse<VersionDto.VersionDetail>> getById(@PathVariable Long id) {
        VersionDto.VersionDetail version = versionService.getById(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Version retrieved", version)
        );
    }

    @PostMapping("/products/{productId}/versions")
    public ResponseEntity<ApiResponse<VersionDto.VersionDetail>> create(
            @PathVariable Long productId,
            @Valid @RequestBody VersionDto.CreateVersionRequest request) {
        VersionDto.VersionDetail version = versionService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ApiResponse<>(true, "Version created", version));
    }

    @PatchMapping("/versions/{id}")
    public ResponseEntity<ApiResponse<VersionDto.VersionDetail>> update(
            @PathVariable Long id,
            @Valid @RequestBody VersionDto.UpdateVersionRequest request) {
        VersionDto.VersionDetail version = versionService.update(id, request);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Version updated", version)
        );
    }

    @PostMapping("/versions/{id}/copy")
    public ResponseEntity<ApiResponse<VersionDto.VersionDetail>> copy(
            @PathVariable Long id,
            @Valid @RequestBody VersionDto.VersionCopyRequest request) {
        VersionDto.VersionDetail version = versionService.copy(id, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ApiResponse<>(true, "Version copied", version));
    }

    @DeleteMapping("/versions/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        versionService.delete(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Version deleted", null)
        );
    }

    @GetMapping("/versions/{id}/failed-test-cases")
    public ResponseEntity<ApiResponse<List<VersionDto.FailedTestCaseInfo>>> getFailedTestCases(@PathVariable Long id) {
        List<VersionDto.FailedTestCaseInfo> failedTcs = versionService.getFailedTestCases(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Failed test cases retrieved", failedTcs)
        );
    }
}
