package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/test-cases")
@RequiredArgsConstructor
public class TestCaseController {
    private final TestCaseService testCaseService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TestCaseDto.TestCaseResponse>>> getByFeatureId(@RequestParam Long featureId) {
        List<TestCaseDto.TestCaseResponse> result = testCaseService.getByFeatureId(featureId);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TestCaseDto.TestCaseResponse>> create(@RequestBody TestCaseDto.TestCaseRequest request) {
        TestCaseDto.TestCaseResponse result = testCaseService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TestCaseDto.TestCaseResponse>> update(
            @PathVariable Long id,
            @RequestBody TestCaseDto.TestCaseRequest request) {
        TestCaseDto.TestCaseResponse result = testCaseService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        testCaseService.delete(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Test case deleted successfully", null));
    }

    @PostMapping("/generate-draft")
    public ResponseEntity<ApiResponse<List<TestCaseDto.TestCaseResponse>>> generateDraft(@RequestParam Long featureId) {
        List<TestCaseDto.TestCaseResponse> result = testCaseService.generateDraft(featureId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }
}
