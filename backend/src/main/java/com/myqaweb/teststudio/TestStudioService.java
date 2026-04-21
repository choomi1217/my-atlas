package com.myqaweb.teststudio;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Test Studio service — orchestrates document-based DRAFT TC generation.
 */
public interface TestStudioService {

    /**
     * Submit a new Test Studio job.
     * Persists a PENDING row and kicks off async generation.
     *
     * @param productId  target product
     * @param sourceType MARKDOWN or PDF
     * @param title      user-supplied title (required)
     * @param content    markdown text (required when sourceType=MARKDOWN)
     * @param file       uploaded PDF (required when sourceType=PDF)
     * @return newly created jobId
     */
    Long submitJob(Long productId, SourceType sourceType, String title, String content, MultipartFile file);

    /**
     * Fetch a single job by id.
     */
    TestStudioJobDto.JobResponse getJob(Long id);

    /**
     * List all jobs for a product, newest first.
     */
    List<TestStudioJobDto.JobResponse> listJobs(Long productId);

    /**
     * List all jobs across every Product within a Company, newest first.
     */
    List<TestStudioJobDto.JobResponse> listJobsByCompany(Long companyId);

    /**
     * Delete a job row.
     * DRAFT TCs created by this job are preserved (FK uses ON DELETE SET NULL).
     */
    void deleteJob(Long id);
}
