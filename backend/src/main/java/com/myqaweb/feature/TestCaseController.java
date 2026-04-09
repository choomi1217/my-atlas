package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
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
    private final TestCaseImageRepository testCaseImageRepository;
    private final TestCaseRepository testCaseRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TestCaseDto.TestCaseResponse>>> getByProductId(
            @RequestParam Long productId) {
        List<TestCaseDto.TestCaseResponse> result = testCaseService.getByProductId(productId);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TestCaseDto.TestCaseResponse>> create(
            @Valid @RequestBody TestCaseDto.TestCaseRequest request) {
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
    public ResponseEntity<ApiResponse<List<TestCaseDto.TestCaseResponse>>> generateDraft(
            @RequestBody TestCaseDto.GenerateDraftRequest request) {
        List<TestCaseDto.TestCaseResponse> result = testCaseService.generateDraft(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }

    /**
     * GET /api/test-cases/{id}/images — List images for a test case.
     */
    @GetMapping("/{id}/images")
    public ResponseEntity<ApiResponse<List<TestCaseDto.TestCaseImageResponse>>> getImages(@PathVariable Long id) {
        List<TestCaseDto.TestCaseImageResponse> images =
                testCaseImageRepository.findAllByTestCaseIdOrderByOrderIndex(id)
                        .stream()
                        .map(img -> new TestCaseDto.TestCaseImageResponse(
                                img.getId(), img.getFilename(), img.getOriginalName(),
                                img.getOrderIndex(), "/api/feature-images/" + img.getFilename()))
                        .toList();
        return ResponseEntity.ok(ApiResponse.ok(images));
    }

    /**
     * POST /api/test-cases/{id}/images — Link an uploaded image to a test case.
     */
    @PostMapping("/{id}/images")
    public ResponseEntity<ApiResponse<TestCaseDto.TestCaseImageResponse>> addImage(
            @PathVariable Long id,
            @RequestBody AddImageRequest request) {
        TestCaseEntity testCase = testCaseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Test case not found: " + id));

        int nextOrder = testCaseImageRepository.countByTestCaseId(id) + 1;

        TestCaseImageEntity entity = new TestCaseImageEntity();
        entity.setTestCase(testCase);
        entity.setFilename(request.filename());
        entity.setOriginalName(request.originalName());
        entity.setOrderIndex(nextOrder);

        TestCaseImageEntity saved = testCaseImageRepository.save(entity);
        TestCaseDto.TestCaseImageResponse response = new TestCaseDto.TestCaseImageResponse(
                saved.getId(), saved.getFilename(), saved.getOriginalName(),
                saved.getOrderIndex(), "/api/feature-images/" + saved.getFilename());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    /**
     * DELETE /api/test-cases/{id}/images/{imageId} — Remove an image from a test case.
     */
    @DeleteMapping("/{id}/images/{imageId}")
    public ResponseEntity<ApiResponse<Void>> removeImage(
            @PathVariable Long id,
            @PathVariable Long imageId) {
        testCaseImageRepository.deleteById(imageId);
        return ResponseEntity.ok(new ApiResponse<>(true, "Image removed", null));
    }

    public record AddImageRequest(String filename, String originalName) {}
}
