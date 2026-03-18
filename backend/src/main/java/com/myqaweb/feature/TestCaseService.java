package com.myqaweb.feature;

import java.util.List;
import java.util.Optional;

public interface TestCaseService {
    /**
     * Get all test cases for a feature.
     *
     * @param featureId the feature ID
     * @return list of test cases
     */
    List<TestCaseDto.TestCaseResponse> getByFeatureId(Long featureId);

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
     * Generate test case drafts using AI based on feature information.
     *
     * @param featureId the feature ID
     * @return list of generated draft test cases
     */
    List<TestCaseDto.TestCaseResponse> generateDraft(Long featureId);
}
