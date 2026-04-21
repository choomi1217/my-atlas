package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller for user-triggered Segment Path edits on test cases.
 *
 * <p>Three flows:
 * <ul>
 *     <li>{@code PATCH /api/test-cases/{id}/path} — user manually replaces the path (drag-and-drop, modal picker).</li>
 *     <li>{@code POST /api/test-cases/{id}/apply-suggested-path} — user applies the Claude recommendation for a single TC.</li>
 *     <li>{@code POST /api/test-cases/bulk-apply-suggested-path} — user applies recommendations for multiple TCs at once.</li>
 * </ul>
 *
 * <p>None of these endpoints run automatically during Test Studio generation — the generation pipeline
 * always leaves {@code path = []} and stores only the suggestion. Every path change here is triggered
 * by an explicit user action.
 */
@RestController
@RequestMapping("/api/test-cases")
@RequiredArgsConstructor
public class TestCasePathController {

    private final TestCaseService testCaseService;

    @PatchMapping("/{id}/path")
    public ResponseEntity<ApiResponse<TestCaseDto.TestCaseResponse>> updatePath(
            @PathVariable Long id,
            @RequestBody TestCaseDto.UpdatePathRequest request) {
        TestCaseDto.TestCaseResponse result =
                testCaseService.updatePath(id, request == null ? null : request.path());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping("/{id}/apply-suggested-path")
    public ResponseEntity<ApiResponse<TestCaseDto.ApplySuggestedPathResponse>> applySuggestedPath(
            @PathVariable Long id) {
        TestCaseDto.ApplySuggestedPathResponse result = testCaseService.applySuggestedPath(id);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping("/bulk-apply-suggested-path")
    public ResponseEntity<ApiResponse<List<TestCaseDto.ApplySuggestedPathResponse>>> bulkApplySuggestedPath(
            @Valid @RequestBody TestCaseDto.BulkApplySuggestedPathRequest request) {
        List<TestCaseDto.ApplySuggestedPathResponse> results =
                testCaseService.bulkApplySuggestedPath(request.testCaseIds());
        return ResponseEntity.ok(ApiResponse.ok(results));
    }
}
