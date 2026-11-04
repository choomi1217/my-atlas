package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestResultServiceImplTest {
    @Mock
    private TestResultRepository testResultRepository;

    @Mock
    private TestRunRepository testRunRepository;

    @Mock
    private TestRunTestCaseRepository testRunTestCaseRepository;

    @Mock
    private TestCaseRepository testCaseRepository;

    @InjectMocks
    private TestResultServiceImpl service;

    private TestResultEntity result;

    @BeforeEach
    void setUp() {
        result = new TestResultEntity();
        result.setId(1L);
        result.setStatus(RunResultStatus.UNTESTED);
        result.setComment(null);
    }

    @Test
    void testUpdateResult_UpdateStatus() {
        // Given
        TestResultEntity updated = new TestResultEntity();
        updated.setId(1L);
        updated.setStatus(RunResultStatus.PASS);
        updated.setComment("All tests passed");
        updated.setExecutedAt(LocalDateTime.now());

        when(testResultRepository.findById(1L)).thenReturn(Optional.of(result));
        when(testResultRepository.save(any())).thenReturn(updated);

        // When
        TestResultEntity testResult = service.updateResult(1L, RunResultStatus.PASS, "All tests passed", null);

        // Then
        assertNotNull(testResult);
        assertEquals(RunResultStatus.PASS, testResult.getStatus());
        assertEquals("All tests passed", testResult.getComment());
        assertNotNull(testResult.getExecutedAt());
        verify(testResultRepository).findById(1L);
        verify(testResultRepository).save(any());
    }

    @Test
    void testUpdateResult_UpdateToUntested() {
        // Given
        result.setStatus(RunResultStatus.PASS);
        result.setComment("Previous comment");
        result.setExecutedAt(LocalDateTime.now());

        TestResultEntity updated = new TestResultEntity();
        updated.setId(1L);
        updated.setStatus(RunResultStatus.UNTESTED);
        updated.setComment("Updated to untested");
        updated.setExecutedAt(null); // Should be cleared

        when(testResultRepository.findById(1L)).thenReturn(Optional.of(result));
        when(testResultRepository.save(any())).thenReturn(updated);

        // When
        TestResultEntity testResult = service.updateResult(1L, RunResultStatus.UNTESTED, "Updated to untested", null);

        // Then
        assertEquals(RunResultStatus.UNTESTED, testResult.getStatus());
        assertNull(testResult.getExecutedAt());
        verify(testResultRepository).save(any());
    }

    @Test
    void testUpdateResult_AddComment() {
        // Given
        TestResultEntity updated = new TestResultEntity();
        updated.setId(1L);
        updated.setStatus(RunResultStatus.PASS);
        updated.setComment("First comment");
        updated.setExecutedAt(LocalDateTime.now());

        when(testResultRepository.findById(1L)).thenReturn(Optional.of(result));
        when(testResultRepository.save(any())).thenReturn(updated);

        // When
        TestResultEntity testResult = service.updateResult(1L, RunResultStatus.PASS, "First comment", null);

        // Then
        assertEquals("First comment", testResult.getComment());
        verify(testResultRepository).save(any());
    }

    @Test
    void testUpdateResult_ResultNotFound() {
        // Given
        when(testResultRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class,
                () -> service.updateResult(999L, RunResultStatus.PASS, "Comment", null));
        verify(testResultRepository, never()).save(any());
    }

    // --- registry_v32 Step 2: priority / executedBy / comment ---

    /** AI FAIL result with a reason and a TC of the given priority; save returns the same entity. */
    private TestResultEntity givenAgentFail(Priority tcPriority) {
        TestCaseEntity tc = new TestCaseEntity();
        tc.setId(10L);
        tc.setPriority(tcPriority);
        result.setTestCase(tc);
        result.setStatus(RunResultStatus.FAIL);
        result.setExecutedBy(ExecutedBy.AGENT);
        result.setComment("[AI FAIL] #2 FAIL: 버튼 없음");
        when(testResultRepository.findById(1L)).thenReturn(Optional.of(result));
        when(testResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        return result;
    }

    @Test
    void testUpdateResult_StatusChanged_SwitchesToHuman() {
        givenAgentFail(Priority.MEDIUM);

        TestResultEntity updated = service.updateResult(1L, RunResultStatus.PASS, null, null);

        assertEquals(ExecutedBy.HUMAN, updated.getExecutedBy());
        assertEquals(RunResultStatus.PASS, updated.getStatus());
    }

    @Test
    void testUpdateResult_PriorityOnly_KeepsAgent() {
        givenAgentFail(Priority.MEDIUM);

        TestResultEntity updated = service.updateResult(1L, RunResultStatus.FAIL, null, TicketPriority.HIGHEST);

        assertEquals(ExecutedBy.AGENT, updated.getExecutedBy());
        assertEquals(TicketPriority.HIGHEST, updated.getPriority());
    }

    @Test
    void testUpdateResult_NullComment_KeepsExistingComment() {
        givenAgentFail(Priority.MEDIUM);

        TestResultEntity updated = service.updateResult(1L, RunResultStatus.PASS, null, null);

        assertEquals("[AI FAIL] #2 FAIL: 버튼 없음", updated.getComment());
    }

    @Test
    void testUpdateResult_CommentGiven_Overwrites() {
        givenAgentFail(Priority.MEDIUM);

        TestResultEntity updated = service.updateResult(1L, RunResultStatus.FAIL, "사람 메모", null);

        assertEquals("사람 메모", updated.getComment());
    }

    @Test
    void testUpdateResult_FailWithoutPriority_HighTcMapsToHigh() {
        assertFailMapsTcPriority(Priority.HIGH, TicketPriority.HIGH);
    }

    @Test
    void testUpdateResult_FailWithoutPriority_MediumTcMapsToMedium() {
        assertFailMapsTcPriority(Priority.MEDIUM, TicketPriority.MEDIUM);
    }

    @Test
    void testUpdateResult_FailWithoutPriority_LowTcMapsToLow() {
        assertFailMapsTcPriority(Priority.LOW, TicketPriority.LOW);
    }

    private void assertFailMapsTcPriority(Priority tcPriority, TicketPriority expected) {
        TestCaseEntity tc = new TestCaseEntity();
        tc.setPriority(tcPriority);
        result.setTestCase(tc);
        result.setStatus(RunResultStatus.UNTESTED);
        when(testResultRepository.findById(1L)).thenReturn(Optional.of(result));
        when(testResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TestResultEntity updated = service.updateResult(1L, RunResultStatus.FAIL, null, null);

        assertEquals(expected, updated.getPriority());
        assertEquals(ExecutedBy.HUMAN, updated.getExecutedBy());
    }

    @Test
    void testUpdateResult_RequestPriorityWinsOverTcPriority() {
        givenAgentFail(Priority.LOW);
        result.setStatus(RunResultStatus.UNTESTED);

        TestResultEntity updated = service.updateResult(1L, RunResultStatus.FAIL, null, TicketPriority.HIGHEST);

        assertEquals(TicketPriority.HIGHEST, updated.getPriority());
    }

    @Test
    void testUpdateResult_FailWithExistingPriority_NotOverwrittenByTc() {
        givenAgentFail(Priority.LOW);
        result.setPriority(TicketPriority.HIGHEST);

        TestResultEntity updated = service.updateResult(1L, RunResultStatus.FAIL, null, null);

        assertEquals(TicketPriority.HIGHEST, updated.getPriority());
    }

    @Test
    void testUpdateResult_PassWithoutPriority_StaysUnknown() {
        givenAgentFail(Priority.HIGH);

        TestResultEntity updated = service.updateResult(1L, RunResultStatus.PASS, null, null);

        assertNull(updated.getPriority());
    }

    @Test
    void testGetAllByVersionId_Success() {
        // Given
        TestResultEntity result1 = new TestResultEntity();
        result1.setId(1L);
        result1.setStatus(RunResultStatus.PASS);

        TestResultEntity result2 = new TestResultEntity();
        result2.setId(2L);
        result2.setStatus(RunResultStatus.FAIL);

        when(testResultRepository.findAllByVersionId(1L))
                .thenReturn(List.of(result1, result2));

        // When
        List<TestResultEntity> results = service.getAllByVersionId(1L);

        // Then
        assertEquals(2, results.size());
        assertEquals(RunResultStatus.PASS, results.get(0).getStatus());
        assertEquals(RunResultStatus.FAIL, results.get(1).getStatus());
        verify(testResultRepository).findAllByVersionId(1L);
    }

    @Test
    void testGetAllByVersionPhaseId_Success() {
        // Given
        TestResultEntity result1 = new TestResultEntity();
        result1.setId(1L);
        result1.setStatus(RunResultStatus.PASS);

        when(testResultRepository.findAllByVersionPhaseId(1L))
                .thenReturn(List.of(result1));

        // When
        List<TestResultEntity> results = service.getAllByVersionPhaseId(1L);

        // Then
        assertEquals(1, results.size());
        verify(testResultRepository).findAllByVersionPhaseId(1L);
    }

    @Test
    void testComputeVersionProgress_OptionA_AllCompleted() {
        // Given - Phase 1: 10 결과 (Pass 8, Fail 2)
        // Phase 2: 8 결과 (Pass 6, Fail 2)
        // Total: 18/18 완료, Pass 14, Fail 4
        List<TestResultEntity> results = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.PASS);
            results.add(r);
        }
        for (int i = 0; i < 2; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.FAIL);
            results.add(r);
        }
        for (int i = 0; i < 6; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.PASS);
            results.add(r);
        }
        for (int i = 0; i < 2; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.FAIL);
            results.add(r);
        }

        when(testResultRepository.findAllByVersionId(1L)).thenReturn(results);

        // When
        VersionDto.ProgressStats progress = service.computeVersionProgress(1L);

        // Then
        assertEquals(18, progress.total());
        assertEquals(18, progress.completed());
        assertEquals(14, progress.pass());
        assertEquals(4, progress.fail());
        assertEquals(0, progress.blocked());
        assertEquals(0, progress.skipped());
        assertEquals(0, progress.retest());
        assertEquals(0, progress.untested());
    }

    @Test
    void testComputePhaseProgress_OptionB() {
        // Given - Phase with 10 results: Pass 8, Fail 2
        List<TestResultEntity> results = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.PASS);
            results.add(r);
        }
        for (int i = 0; i < 2; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.FAIL);
            results.add(r);
        }

        when(testResultRepository.findAllByVersionPhaseId(1L)).thenReturn(results);

        // When
        VersionDto.ProgressStats progress = service.computePhaseProgress(1L);

        // Then
        assertEquals(10, progress.total());
        assertEquals(10, progress.completed());
        assertEquals(8, progress.pass());
        assertEquals(2, progress.fail());
    }

    @Test
    void testComputeProgress_UntestedExcluded() {
        // Given - 10 results: PASS 6, FAIL 2, UNTESTED 2
        List<TestResultEntity> results = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.PASS);
            results.add(r);
        }
        for (int i = 0; i < 2; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.FAIL);
            results.add(r);
        }
        for (int i = 0; i < 2; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setStatus(RunResultStatus.UNTESTED);
            results.add(r);
        }

        when(testResultRepository.findAllByVersionId(1L)).thenReturn(results);

        // When
        VersionDto.ProgressStats progress = service.computeVersionProgress(1L);

        // Then
        assertEquals(10, progress.total());
        assertEquals(8, progress.completed()); // UNTESTED not counted
        assertEquals(6, progress.pass());
        assertEquals(2, progress.fail());
        assertEquals(2, progress.untested());
    }

    @Test
    void testComputeProgress_AllStatuses() {
        // Given - Mixed statuses
        List<TestResultEntity> results = new ArrayList<>();

        TestResultEntity pass = new TestResultEntity();
        pass.setStatus(RunResultStatus.PASS);
        results.add(pass);

        TestResultEntity fail = new TestResultEntity();
        fail.setStatus(RunResultStatus.FAIL);
        results.add(fail);

        TestResultEntity blocked = new TestResultEntity();
        blocked.setStatus(RunResultStatus.BLOCKED);
        results.add(blocked);

        TestResultEntity skipped = new TestResultEntity();
        skipped.setStatus(RunResultStatus.SKIPPED);
        results.add(skipped);

        TestResultEntity retest = new TestResultEntity();
        retest.setStatus(RunResultStatus.RETEST);
        results.add(retest);

        TestResultEntity untested = new TestResultEntity();
        untested.setStatus(RunResultStatus.UNTESTED);
        results.add(untested);

        when(testResultRepository.findAllByVersionId(1L)).thenReturn(results);

        // When
        VersionDto.ProgressStats progress = service.computeVersionProgress(1L);

        // Then
        assertEquals(6, progress.total());
        assertEquals(5, progress.completed()); // All except UNTESTED
        assertEquals(1, progress.pass());
        assertEquals(1, progress.fail());
        assertEquals(1, progress.blocked());
        assertEquals(1, progress.skipped());
        assertEquals(1, progress.retest());
        assertEquals(1, progress.untested());
    }

    @Test
    void testComputeProgress_EmptyResults() {
        // Given - No results
        when(testResultRepository.findAllByVersionId(1L)).thenReturn(List.of());

        // When
        VersionDto.ProgressStats progress = service.computeVersionProgress(1L);

        // Then
        assertEquals(0, progress.total());
        assertEquals(0, progress.completed());
        assertEquals(0, progress.pass());
        assertEquals(0, progress.fail());
    }

    @Test
    void testCreateInitialResults_SingleRun() {
        // Given
        TestCaseEntity tc1 = new TestCaseEntity();
        tc1.setId(10L);
        TestCaseEntity tc2 = new TestCaseEntity();
        tc2.setId(20L);

        TestRunTestCaseEntity rtc1 = new TestRunTestCaseEntity();
        rtc1.setTestCase(tc1);
        TestRunTestCaseEntity rtc2 = new TestRunTestCaseEntity();
        rtc2.setTestCase(tc2);

        when(testRunTestCaseRepository.findAllByTestRunId(1L))
                .thenReturn(List.of(rtc1, rtc2));
        when(testResultRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        // When - single-param overload delegates to list version
        service.createInitialResults(100L, 200L, 1L);

        // Then
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<TestResultEntity>> captor = ArgumentCaptor.forClass(List.class);
        verify(testResultRepository).saveAll(captor.capture());
        List<TestResultEntity> saved = captor.getValue();
        assertEquals(2, saved.size());
        assertTrue(saved.stream().allMatch(r -> r.getStatus() == RunResultStatus.UNTESTED));
    }

    @Test
    void testCreateInitialResults_MultipleRuns_Dedup() {
        // Given - two test runs share testCase 20
        TestCaseEntity tc1 = new TestCaseEntity();
        tc1.setId(10L);
        TestCaseEntity tc2 = new TestCaseEntity();
        tc2.setId(20L);
        TestCaseEntity tc3 = new TestCaseEntity();
        tc3.setId(30L);

        // Run 1 has tc1, tc2
        TestRunTestCaseEntity rtc1a = new TestRunTestCaseEntity();
        rtc1a.setTestCase(tc1);
        TestRunTestCaseEntity rtc1b = new TestRunTestCaseEntity();
        rtc1b.setTestCase(tc2);

        // Run 2 has tc2, tc3 (tc2 is shared)
        TestRunTestCaseEntity rtc2a = new TestRunTestCaseEntity();
        rtc2a.setTestCase(tc2);
        TestRunTestCaseEntity rtc2b = new TestRunTestCaseEntity();
        rtc2b.setTestCase(tc3);

        when(testRunTestCaseRepository.findAllByTestRunId(1L))
                .thenReturn(List.of(rtc1a, rtc1b));
        when(testRunTestCaseRepository.findAllByTestRunId(2L))
                .thenReturn(List.of(rtc2a, rtc2b));
        when(testResultRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        // When
        service.createInitialResults(100L, 200L, List.of(1L, 2L));

        // Then - only 3 unique test cases (tc2 deduplicated)
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<TestResultEntity>> captor = ArgumentCaptor.forClass(List.class);
        verify(testResultRepository).saveAll(captor.capture());
        List<TestResultEntity> saved = captor.getValue();
        assertEquals(3, saved.size());
        // Verify all are UNTESTED
        assertTrue(saved.stream().allMatch(r -> r.getStatus() == RunResultStatus.UNTESTED));
        // Verify the test case IDs are 10, 20, 30 (no duplicates)
        List<Long> testCaseIds = saved.stream()
                .map(r -> r.getTestCase().getId())
                .sorted()
                .toList();
        assertEquals(List.of(10L, 20L, 30L), testCaseIds);
    }

    @Test
    void testCreateInitialResults_EmptyRuns_NoSave() {
        // Given - test run has no test cases
        when(testRunTestCaseRepository.findAllByTestRunId(1L))
                .thenReturn(List.of());

        // When
        service.createInitialResults(100L, 200L, List.of(1L));

        // Then - saveAll should not be called for empty results
        verify(testResultRepository, never()).saveAll(any());
    }

    @Test
    void testCreateInitialResults_WithDirectTestCaseIds() {
        // Given - no test runs, but 2 direct TCs
        TestCaseEntity tc1 = new TestCaseEntity();
        tc1.setId(10L);
        TestCaseEntity tc2 = new TestCaseEntity();
        tc2.setId(20L);

        when(testCaseRepository.findById(10L)).thenReturn(Optional.of(tc1));
        when(testCaseRepository.findById(20L)).thenReturn(Optional.of(tc2));
        when(testResultRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        // When
        service.createInitialResults(100L, 200L, List.of(), List.of(10L, 20L));

        // Then
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<TestResultEntity>> captor = ArgumentCaptor.forClass(List.class);
        verify(testResultRepository).saveAll(captor.capture());
        List<TestResultEntity> saved = captor.getValue();
        assertEquals(2, saved.size());
        assertTrue(saved.stream().allMatch(r -> r.getStatus() == RunResultStatus.UNTESTED));
        List<Long> tcIds = saved.stream()
                .map(r -> r.getTestCase().getId())
                .sorted()
                .toList();
        assertEquals(List.of(10L, 20L), tcIds);
    }

    @Test
    void testCreateInitialResults_WithRunsAndDirectTCs_Dedup() {
        // Given - run has tc10, tc20; direct has tc20, tc30 → dedup tc20
        TestCaseEntity tc10 = new TestCaseEntity();
        tc10.setId(10L);
        TestCaseEntity tc20 = new TestCaseEntity();
        tc20.setId(20L);
        TestCaseEntity tc30 = new TestCaseEntity();
        tc30.setId(30L);

        TestRunTestCaseEntity rtc1 = new TestRunTestCaseEntity();
        rtc1.setTestCase(tc10);
        TestRunTestCaseEntity rtc2 = new TestRunTestCaseEntity();
        rtc2.setTestCase(tc20);

        when(testRunTestCaseRepository.findAllByTestRunId(1L))
                .thenReturn(List.of(rtc1, rtc2));
        when(testCaseRepository.findById(30L)).thenReturn(Optional.of(tc30));
        when(testResultRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        // When
        service.createInitialResults(100L, 200L, List.of(1L), List.of(20L, 30L));

        // Then - tc20 only once (from run), tc30 from direct
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<TestResultEntity>> captor = ArgumentCaptor.forClass(List.class);
        verify(testResultRepository).saveAll(captor.capture());
        List<TestResultEntity> saved = captor.getValue();
        assertEquals(3, saved.size());
        List<Long> tcIds = saved.stream()
                .map(r -> r.getTestCase().getId())
                .sorted()
                .toList();
        assertEquals(List.of(10L, 20L, 30L), tcIds);
    }

    @Test
    void testCreateResultForTestCase_CreatesIfNotExists() {
        // Given
        TestCaseEntity tc = new TestCaseEntity();
        tc.setId(10L);

        when(testResultRepository.findByVersionPhaseIdAndTestCaseId(200L, 10L))
                .thenReturn(Optional.empty());
        when(testCaseRepository.findById(10L)).thenReturn(Optional.of(tc));
        when(testResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // When
        service.createResultForTestCase(100L, 200L, 10L);

        // Then
        verify(testResultRepository).save(any(TestResultEntity.class));
    }

    @Test
    void testCreateResultForTestCase_NoOpIfExists() {
        // Given - result already exists
        TestResultEntity existing = new TestResultEntity();
        existing.setId(99L);
        when(testResultRepository.findByVersionPhaseIdAndTestCaseId(200L, 10L))
                .thenReturn(Optional.of(existing));

        // When
        service.createResultForTestCase(100L, 200L, 10L);

        // Then - should NOT save a new result
        verify(testResultRepository, never()).save(any());
    }
}
