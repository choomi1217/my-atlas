package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * REST controller for TestResult endpoints.
 */
@RestController
@RequestMapping("/api")
@Slf4j
public class TestResultController {
    private final TestResultService testResultService;

    public TestResultController(TestResultService testResultService) {
        this.testResultService = testResultService;
    }

    @GetMapping("/versions/{versionId}/results")
    public ResponseEntity<ApiResponse<List<TestResultResponse>>> getAllByVersionId(@PathVariable Long versionId) {
        List<TestResultEntity> results = testResultService.getAllByVersionId(versionId);
        List<TestResultResponse> response = results.stream().map(this::toResponse).collect(Collectors.toList());
        return ResponseEntity.ok(new ApiResponse<>(true, "Results retrieved", response));
    }

    @GetMapping("/versions/{versionId}/phases/{phaseId}/results")
    public ResponseEntity<ApiResponse<List<TestResultResponse>>> getAllByVersionPhaseId(
            @PathVariable Long versionId,
            @PathVariable Long phaseId) {
        List<TestResultEntity> results = testResultService.getAllByVersionPhaseId(phaseId);
        List<TestResultResponse> response = results.stream().map(this::toResponse).collect(Collectors.toList());
        return ResponseEntity.ok(new ApiResponse<>(true, "Results retrieved", response));
    }

    @PatchMapping("/versions/{versionId}/results/{resultId}")
    public ResponseEntity<ApiResponse<TestResultResponse>> updateResult(
            @PathVariable Long versionId,
            @PathVariable Long resultId,
            @Valid @RequestBody UpdateResultRequest request) {
        TestResultEntity result = testResultService.updateResult(
                resultId,
                request.status(),
                request.comment()
        );
        return ResponseEntity.ok(new ApiResponse<>(true, "Result updated", toResponse(result)));
    }

    private TestResultResponse toResponse(TestResultEntity entity) {
        return new TestResultResponse(
                entity.getId(),
                entity.getVersion().getId(),
                entity.getVersionPhase().getId(),
                entity.getTestCase().getId(),
                entity.getTestCase().getTitle(),
                entity.getStatus(),
                entity.getComment(),
                entity.getExecutedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public record UpdateResultRequest(
            RunResultStatus status,
            String comment
    ) {}

    public record TestResultResponse(
            Long id,
            Long versionId,
            Long versionPhaseId,
            Long testCaseId,
            String testCaseTitle,
            RunResultStatus status,
            String comment,
            LocalDateTime executedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}
}
