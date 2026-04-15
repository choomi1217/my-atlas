package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Service implementation for TestResult operations.
 */
@Service
@Slf4j
public class TestResultServiceImpl implements TestResultService {
    private final TestResultRepository testResultRepository;
    private final TestRunRepository testRunRepository;
    private final TestRunTestCaseRepository testRunTestCaseRepository;

    public TestResultServiceImpl(TestResultRepository testResultRepository,
                                TestRunRepository testRunRepository,
                                TestRunTestCaseRepository testRunTestCaseRepository) {
        this.testResultRepository = testResultRepository;
        this.testRunRepository = testRunRepository;
        this.testRunTestCaseRepository = testRunTestCaseRepository;
    }

    @Override
    @Transactional
    public void createInitialResults(Long versionId, Long phaseId, Long testRunId) {
        createInitialResults(versionId, phaseId, List.of(testRunId));
    }

    @Override
    @Transactional
    public void createInitialResults(Long versionId, Long phaseId, List<Long> testRunIds) {
        Set<Long> seenTestCaseIds = new HashSet<>();
        List<TestResultEntity> results = new ArrayList<>();

        for (Long testRunId : testRunIds) {
            List<TestRunTestCaseEntity> testRunTestCases = testRunTestCaseRepository.findAllByTestRunId(testRunId);
            for (TestRunTestCaseEntity rtc : testRunTestCases) {
                if (seenTestCaseIds.add(rtc.getTestCase().getId())) {
                    TestResultEntity result = new TestResultEntity();
                    result.setVersion(new VersionEntity());
                    result.getVersion().setId(versionId);
                    result.setVersionPhase(new VersionPhaseEntity());
                    result.getVersionPhase().setId(phaseId);
                    result.setTestCase(rtc.getTestCase());
                    result.setStatus(RunResultStatus.UNTESTED);
                    result.setComment(null);
                    result.setExecutedAt(null);
                    results.add(result);
                }
            }
        }

        if (!results.isEmpty()) {
            testResultRepository.saveAll(results);
            log.info("Created {} initial test results for version {} phase {} from {} runs",
                    results.size(), versionId, phaseId, testRunIds.size());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<TestResultEntity> getAllByVersionId(Long versionId) {
        return testResultRepository.findAllByVersionId(versionId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TestResultEntity> getAllByVersionPhaseId(Long versionPhaseId) {
        return testResultRepository.findAllByVersionPhaseId(versionPhaseId);
    }

    @Override
    @Transactional
    public TestResultEntity updateResult(Long resultId, RunResultStatus status, String comment) {
        TestResultEntity result = testResultRepository.findById(resultId)
                .orElseThrow(() -> new EntityNotFoundException("TestResult not found: " + resultId));

        result.setStatus(status);
        result.setComment(comment);
        if (status != RunResultStatus.UNTESTED) {
            result.setExecutedAt(LocalDateTime.now());
        }

        TestResultEntity updated = testResultRepository.save(result);
        log.info("Updated test result: {}", resultId);

        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public VersionDto.ProgressStats computeVersionProgress(Long versionId) {
        List<TestResultEntity> results = testResultRepository.findAllByVersionId(versionId);

        return computeProgress(results);
    }

    @Override
    @Transactional(readOnly = true)
    public VersionDto.ProgressStats computePhaseProgress(Long versionPhaseId) {
        List<TestResultEntity> results = testResultRepository.findAllByVersionPhaseId(versionPhaseId);

        return computeProgress(results);
    }

    private VersionDto.ProgressStats computeProgress(List<TestResultEntity> results) {
        int total = results.size();
        int completed = 0;
        int pass = 0;
        int fail = 0;
        int blocked = 0;
        int skipped = 0;
        int retest = 0;
        int untested = 0;

        for (TestResultEntity result : results) {
            RunResultStatus status = result.getStatus();
            switch (status) {
                case PASS -> {
                    pass++;
                    completed++;
                }
                case FAIL -> {
                    fail++;
                    completed++;
                }
                case BLOCKED -> {
                    blocked++;
                    completed++;
                }
                case SKIPPED -> {
                    skipped++;
                    completed++;
                }
                case RETEST -> {
                    retest++;
                    completed++;
                }
                case UNTESTED -> untested++;
            }
        }

        return new VersionDto.ProgressStats(
                total,
                completed,
                pass,
                fail,
                blocked,
                skipped,
                retest,
                untested
        );
    }
}
