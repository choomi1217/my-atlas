package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for TestRun endpoints.
 */
@RestController
@RequestMapping("/api")
@Slf4j
public class TestRunController {
    private final TestRunService testRunService;

    public TestRunController(TestRunService testRunService) {
        this.testRunService = testRunService;
    }

    @GetMapping("/products/{productId}/test-runs")
    public ResponseEntity<ApiResponse<List<TestRunDto.TestRunSummary>>> getAllByProductId(@PathVariable Long productId) {
        List<TestRunDto.TestRunSummary> testRuns = testRunService.getAllByProductId(productId);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Test runs retrieved", testRuns)
        );
    }

    @GetMapping("/test-runs/{id}")
    public ResponseEntity<ApiResponse<TestRunDto.TestRunDetail>> getById(@PathVariable Long id) {
        TestRunDto.TestRunDetail testRun = testRunService.getById(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Test run retrieved", testRun)
        );
    }

    @PostMapping("/products/{productId}/test-runs")
    public ResponseEntity<ApiResponse<TestRunDto.TestRunDetail>> create(
            @PathVariable Long productId,
            @Valid @RequestBody TestRunDto.CreateTestRunRequestBody bodyRequest) {
        // Combine path productId with body request
        TestRunDto.CreateTestRunRequest request = new TestRunDto.CreateTestRunRequest(
            productId,
            bodyRequest.name(),
            bodyRequest.description(),
            bodyRequest.testCaseIds()
        );
        TestRunDto.TestRunDetail testRun = testRunService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ApiResponse<>(true, "Test run created", testRun));
    }

    @PatchMapping("/test-runs/{id}")
    public ResponseEntity<ApiResponse<TestRunDto.TestRunDetail>> update(
            @PathVariable Long id,
            @Valid @RequestBody TestRunDto.UpdateTestRunRequest request) {
        TestRunDto.TestRunDetail testRun = testRunService.update(id, request);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Test run updated", testRun)
        );
    }

    @DeleteMapping("/test-runs/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        testRunService.delete(id);
        return ResponseEntity.ok(
                new ApiResponse<>(true, "Test run deleted", null)
        );
    }
}
