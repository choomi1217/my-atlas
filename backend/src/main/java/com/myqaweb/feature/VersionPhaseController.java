package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for VersionPhase endpoints.
 */
@RestController
@RequestMapping("/api")
@Slf4j
public class VersionPhaseController {
    private final VersionPhaseService versionPhaseService;

    public VersionPhaseController(VersionPhaseService versionPhaseService) {
        this.versionPhaseService = versionPhaseService;
    }

    @PostMapping("/versions/{versionId}/phases")
    public ResponseEntity<ApiResponse<VersionDto.VersionPhaseDto>> addPhase(
            @PathVariable Long versionId,
            @Valid @RequestBody VersionDto.PhaseRequest request) {
        VersionDto.VersionPhaseDto phase = versionPhaseService.addPhase(versionId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ApiResponse<>(true, "Phase added", phase));
    }

    @GetMapping("/versions/{versionId}/phases")
    public ResponseEntity<ApiResponse<List<VersionDto.VersionPhaseDto>>> getAllByVersionId(@PathVariable Long versionId) {
        List<VersionDto.VersionPhaseDto> phases = versionPhaseService.getAllByVersionId(versionId);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Phases retrieved", phases)
        );
    }

    @PatchMapping("/versions/{versionId}/phases/{phaseId}")
    public ResponseEntity<ApiResponse<VersionDto.VersionPhaseDto>> updatePhase(
            @PathVariable Long versionId,
            @PathVariable Long phaseId,
            @Valid @RequestBody VersionDto.PhaseRequest request) {
        VersionDto.VersionPhaseDto phase = versionPhaseService.updatePhase(phaseId, request);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Phase updated", phase)
        );
    }

    @DeleteMapping("/versions/{versionId}/phases/{phaseId}")
    public ResponseEntity<ApiResponse<Void>> deletePhase(
            @PathVariable Long versionId,
            @PathVariable Long phaseId) {
        versionPhaseService.deletePhase(versionId, phaseId);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Phase deleted", null)
        );
    }

    @PostMapping("/versions/{versionId}/phases/{phaseId}/reorder")
    public ResponseEntity<ApiResponse<Void>> reorderPhase(
            @PathVariable Long versionId,
            @PathVariable Long phaseId,
            @RequestBody ReorderRequest request) {
        versionPhaseService.reorderPhase(versionId, phaseId, request.newOrderIndex());
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Phase reordered", null)
        );
    }

    @PostMapping("/versions/{versionId}/phases/{phaseId}/test-cases")
    public ResponseEntity<ApiResponse<Void>> addTestCasesToPhase(
            @PathVariable Long versionId,
            @PathVariable Long phaseId,
            @Valid @RequestBody VersionDto.PhaseTestCaseIdsRequest request) {
        versionPhaseService.addTestCasesToPhase(versionId, phaseId, request.testCaseIds());
        return ResponseEntity.ok(new ApiResponse<>(true, "Test cases added to phase", null));
    }

    @DeleteMapping("/versions/{versionId}/phases/{phaseId}/test-cases")
    public ResponseEntity<ApiResponse<Void>> removeTestCasesFromPhase(
            @PathVariable Long versionId,
            @PathVariable Long phaseId,
            @RequestBody VersionDto.PhaseTestCaseIdsRequest request) {
        versionPhaseService.removeTestCasesFromPhase(phaseId, request.testCaseIds());
        return ResponseEntity.ok(new ApiResponse<>(true, "Test cases removed from phase", null));
    }

    public record ReorderRequest(Integer newOrderIndex) {}
}
