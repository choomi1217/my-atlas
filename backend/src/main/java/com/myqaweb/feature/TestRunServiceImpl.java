package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service implementation for TestRun operations.
 */
@Service
@Slf4j
public class TestRunServiceImpl implements TestRunService {
    private final TestRunRepository testRunRepository;
    private final ProductRepository productRepository;
    private final TestCaseRepository testCaseRepository;
    private final TestRunTestCaseRepository testRunTestCaseRepository;
    private final TestResultRepository testResultRepository;

    public TestRunServiceImpl(TestRunRepository testRunRepository,
                             ProductRepository productRepository,
                             TestCaseRepository testCaseRepository,
                             TestRunTestCaseRepository testRunTestCaseRepository,
                             TestResultRepository testResultRepository) {
        this.testRunRepository = testRunRepository;
        this.productRepository = productRepository;
        this.testCaseRepository = testCaseRepository;
        this.testRunTestCaseRepository = testRunTestCaseRepository;
        this.testResultRepository = testResultRepository;
    }

    @Override
    @Transactional
    public TestRunDto.TestRunDetail create(TestRunDto.CreateTestRunRequest request) {
        // Validate product exists
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + request.productId()));

        // Validate test cases exist
        List<TestCaseEntity> testCases = testCaseRepository.findAllById(request.testCaseIds());
        if (testCases.size() != request.testCaseIds().size()) {
            throw new IllegalArgumentException("Some test cases not found");
        }

        // Check for duplicate name within product
        if (testRunRepository.findByProductIdAndName(request.productId(), request.name()).isPresent()) {
            throw new IllegalArgumentException("TestRun with name '" + request.name() + "' already exists in this product");
        }

        // Create test run
        TestRunEntity testRun = new TestRunEntity();
        testRun.setProduct(product);
        testRun.setName(request.name());
        testRun.setDescription(request.description());

        TestRunEntity saved = testRunRepository.save(testRun);

        // Create junction table entries
        List<TestRunTestCaseEntity> associations = testCases.stream()
                .map(tc -> {
                    TestRunTestCaseEntity rtc = new TestRunTestCaseEntity();
                    rtc.setTestRun(saved);
                    rtc.setTestCase(tc);
                    return rtc;
                })
                .collect(Collectors.toList());
        testRunTestCaseRepository.saveAll(associations);

        log.info("Created test run: {} with {} test cases", saved.getId(), testCases.size());

        return toDetail(saved, testCases);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TestRunDto.TestRunSummary> getAllByProductId(Long productId) {
        List<TestRunEntity> testRuns = testRunRepository.findAllByProductIdOrderByCreatedAtDesc(productId);
        return testRuns.stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public TestRunDto.TestRunDetail getById(Long id) {
        TestRunEntity testRun = testRunRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + id));

        // Fetch test cases from junction table
        List<TestRunTestCaseEntity> associations = testRunTestCaseRepository.findAllByTestRunId(id);
        List<TestCaseEntity> testCases = associations.stream()
                .map(TestRunTestCaseEntity::getTestCase)
                .collect(Collectors.toList());

        return toDetail(testRun, testCases);
    }

    @Override
    @Transactional
    public TestRunDto.TestRunSummary updateTestRun(Long id, TestRunDto.UpdateTestRunRequest request) {
        TestRunEntity testRun = testRunRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + id));

        // Validate all test cases exist
        List<TestCaseEntity> testCases = testCaseRepository.findAllById(request.testCaseIds());
        if (testCases.size() != request.testCaseIds().size()) {
            throw new IllegalArgumentException("Some test cases not found");
        }

        // Update test run name and description
        testRun.setName(request.name());
        testRun.setDescription(request.description());

        // Delete existing test case associations
        testRunTestCaseRepository.deleteByTestRunId(id);

        // Create new test case associations (remove duplicates using Set)
        Set<Long> uniqueTestCaseIds = new HashSet<>(request.testCaseIds());
        List<TestRunTestCaseEntity> newAssociations = uniqueTestCaseIds.stream()
                .map(tcId -> {
                    TestRunTestCaseEntity rtc = new TestRunTestCaseEntity();
                    rtc.setTestRun(testRun);
                    TestCaseEntity tc = new TestCaseEntity();
                    tc.setId(tcId);
                    rtc.setTestCase(tc);
                    return rtc;
                })
                .collect(Collectors.toList());

        testRunTestCaseRepository.saveAll(newAssociations);

        // Save updated test run
        TestRunEntity updated = testRunRepository.save(testRun);
        log.info("Updated test run: {} with {} test cases", id, uniqueTestCaseIds.size());

        return toSummary(updated);
    }

    @Override
    @Transactional
    public void deleteTestRun(Long id) {
        TestRunEntity testRun = testRunRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + id));

        // Delete test_result records via cascade
        testResultRepository.deleteByTestRunIdViaPhase(id);

        // Delete test_run_test_case records via cascade
        testRunTestCaseRepository.deleteByTestRunId(id);

        // Delete test run
        testRunRepository.deleteById(id);
        log.info("Deleted test run: {}", id);
    }

    @Override
    @Transactional
    public TestRunDto.TestRunDetail update(Long id, TestRunDto.UpdateTestRunRequest request) {
        TestRunEntity testRun = testRunRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + id));

        if (request.name() != null) {
            testRun.setName(request.name());
        }
        if (request.description() != null) {
            testRun.setDescription(request.description());
        }
        if (request.testCaseIds() != null && !request.testCaseIds().isEmpty()) {
            // Delete existing associations and recreate
            testRunTestCaseRepository.deleteByTestRunId(id);
            Set<Long> uniqueIds = new HashSet<>(request.testCaseIds());
            List<TestRunTestCaseEntity> newAssociations = uniqueIds.stream()
                    .map(tcId -> {
                        TestRunTestCaseEntity rtc = new TestRunTestCaseEntity();
                        rtc.setTestRun(testRun);
                        TestCaseEntity tc = new TestCaseEntity();
                        tc.setId(tcId);
                        rtc.setTestCase(tc);
                        return rtc;
                    })
                    .collect(Collectors.toList());
            testRunTestCaseRepository.saveAll(newAssociations);
        }

        TestRunEntity updated = testRunRepository.save(testRun);
        log.info("Updated test run: {}", id);

        List<TestRunTestCaseEntity> associations = testRunTestCaseRepository.findAllByTestRunId(id);
        List<TestCaseEntity> testCases = associations.stream()
                .map(TestRunTestCaseEntity::getTestCase)
                .collect(Collectors.toList());

        return toDetail(updated, testCases);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        deleteTestRun(id);
    }

    private TestRunDto.TestRunSummary toSummary(TestRunEntity entity) {
        int testCaseCount = testRunTestCaseRepository.findAllByTestRunId(entity.getId()).size();

        return new TestRunDto.TestRunSummary(
                entity.getId(),
                entity.getProduct().getId(),
                entity.getName(),
                entity.getDescription(),
                testCaseCount,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private TestRunDto.TestRunDetail toDetail(TestRunEntity entity, List<TestCaseEntity> testCases) {
        List<TestRunDto.TestCaseSummary> tcSummaries = testCases.stream()
                .map(tc -> new TestRunDto.TestCaseSummary(tc.getId(), tc.getTitle()))
                .collect(Collectors.toList());

        return new TestRunDto.TestRunDetail(
                entity.getId(),
                entity.getProduct().getId(),
                entity.getName(),
                entity.getDescription(),
                tcSummaries,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
