package com.myqaweb.feature;

import java.util.List;
import java.util.Optional;

public interface TestCaseService {
    /**
     * Get all test cases for a product.
     *
     * @param productId the product ID
     * @return list of test cases
     */
    List<TestCaseDto.TestCaseResponse> getByProductId(Long productId);

    /**
     * Get a test case by ID.
     *
     * @param id the test case ID
     * @return optional containing the test case
     */
    Optional<TestCaseDto.TestCaseResponse> findById(Long id);

    /**
     * Create a new test case.
     *
     * @param request the test case request
     * @return the created test case
     */
    TestCaseDto.TestCaseResponse create(TestCaseDto.TestCaseRequest request);

    /**
     * Update an existing test case.
     *
     * @param id the test case ID
     * @param request the update request
     * @return the updated test case
     */
    TestCaseDto.TestCaseResponse update(Long id, TestCaseDto.TestCaseRequest request);

    /**
     * Delete a test case.
     *
     * @param id the test case ID
     */
    void delete(Long id);

    /**
     * Generate test case drafts using AI based on segment path and context.
     *
     * @param request the generate draft request containing productId and path
     * @return list of generated draft test cases
     */
    List<TestCaseDto.TestCaseResponse> generateDraft(TestCaseDto.GenerateDraftRequest request);

    /**
     * Get all test cases for a company (across all products).
     *
     * @param companyId the company ID
     * @param status optional status filter (null = all statuses)
     * @return list of test cases
     */
    List<TestCaseDto.TestCaseResponse> getByCompanyId(Long companyId, TestStatus status);

    /**
     * Replace the segment path of a test case. User-triggered action.
     *
     * @param testCaseId the test case ID
     * @param path new segment-ID path (empty array means unassigned)
     * @return updated test case
     */
    TestCaseDto.TestCaseResponse updatePath(Long testCaseId, Long[] path);

    /**
     * Apply the Claude-suggested segment path to a single TC. User-triggered action.
     *
     * @param testCaseId the test case ID
     * @return resolution result (resolved path, length, whether fully matched)
     */
    TestCaseDto.ApplySuggestedPathResponse applySuggestedPath(Long testCaseId);

    /**
     * Apply suggested paths to multiple TCs in one call. User-triggered bulk action.
     *
     * @param testCaseIds list of TC IDs
     * @return per-TC results
     */
    List<TestCaseDto.ApplySuggestedPathResponse> bulkApplySuggestedPath(List<Long> testCaseIds);
}
