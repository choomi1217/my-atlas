package com.myqaweb.feature;

import java.util.List;

/**
 * Service interface for TestRun operations.
 */
public interface TestRunService {
    /**
     * Create a new test run.
     */
    TestRunDto.TestRunDetail create(TestRunDto.CreateTestRunRequest request);

    /**
     * Get all test runs for a product.
     */
    List<TestRunDto.TestRunSummary> getAllByProductId(Long productId);

    /**
     * Get test run by ID with details.
     */
    TestRunDto.TestRunDetail getById(Long id);

    /**
     * Update test run with name, description, and test cases.
     */
    TestRunDto.TestRunSummary updateTestRun(Long id, TestRunDto.UpdateTestRunRequest request);

    /**
     * Delete test run with all cascading data.
     */
    void deleteTestRun(Long id);

    /**
     * Update test run (legacy method).
     */
    TestRunDto.TestRunDetail update(Long id, TestRunDto.UpdateTestRunRequest request);

    /**
     * Delete test run (legacy method).
     */
    void delete(Long id);
}
