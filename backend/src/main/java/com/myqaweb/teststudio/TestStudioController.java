package com.myqaweb.teststudio;

import com.myqaweb.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for Test Studio jobs.
 * All responses are wrapped in {@link ApiResponse}.
 */
@RestController
@RequestMapping("/api/test-studio")
@RequiredArgsConstructor
public class TestStudioController {

    private final TestStudioService testStudioService;

    /**
     * Create a new job.
     * multipart/form-data with productId, sourceType, title, content (MARKDOWN) or file (PDF).
     */
    @PostMapping("/jobs")
    public ResponseEntity<ApiResponse<Map<String, Long>>> createJob(
            @RequestParam("productId") Long productId,
            @RequestParam("sourceType") SourceType sourceType,
            @RequestParam("title") String title,
            @RequestParam(value = "content", required = false) String content,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        Long jobId = testStudioService.submitJob(productId, sourceType, title, content, file);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Test Studio job created", Map.of("jobId", jobId)));
    }

    /**
     * List jobs for a product or company (newest first).
     * Exactly one of {productId, companyId} must be provided.
     */
    @GetMapping("/jobs")
    public ResponseEntity<ApiResponse<List<TestStudioJobDto.JobResponse>>> listJobs(
            @RequestParam(value = "productId", required = false) Long productId,
            @RequestParam(value = "companyId", required = false) Long companyId) {
        if (productId == null && companyId == null) {
            throw new IllegalArgumentException("productId or companyId is required");
        }
        if (productId != null && companyId != null) {
            throw new IllegalArgumentException("productId and companyId are mutually exclusive");
        }
        List<TestStudioJobDto.JobResponse> jobs = productId != null
                ? testStudioService.listJobs(productId)
                : testStudioService.listJobsByCompany(companyId);
        return ResponseEntity.ok(ApiResponse.ok(jobs));
    }

    /**
     * Get a single job.
     */
    @GetMapping("/jobs/{id}")
    public ResponseEntity<ApiResponse<TestStudioJobDto.JobResponse>> getJob(@PathVariable Long id) {
        TestStudioJobDto.JobResponse job = testStudioService.getJob(id);
        return ResponseEntity.ok(ApiResponse.ok(job));
    }

    /**
     * Delete a job. DRAFT TCs created by this job are preserved.
     */
    @DeleteMapping("/jobs/{id}")
    public ResponseEntity<Void> deleteJob(@PathVariable Long id) {
        testStudioService.deleteJob(id);
        return ResponseEntity.noContent().build();
    }
}
