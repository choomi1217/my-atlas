package com.myqaweb.feature;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AgentExecutionServiceImplTest {

    @Mock private AgentExecutionJobRepository jobRepository;
    @Mock private AgentExecutionResultRepository resultRepository;
    @Mock private TestCaseRepository testCaseRepository;
    @Mock private ProductRepository productRepository;
    @Mock private VersionPhaseRepository versionPhaseRepository;
    @Mock private TestResultRepository testResultRepository;
    @Mock private SegmentRepository segmentRepository;

    @InjectMocks private AgentExecutionServiceImpl service;

    private AgentExecutionJobEntity job(Long id, AgentExecutionScope scope, AgentExecutionStatus status, Long phaseId) {
        AgentExecutionJobEntity j = new AgentExecutionJobEntity();
        j.setId(id);
        j.setProductId(10L);
        j.setScope(scope);
        j.setStatus(status);
        j.setPhaseId(phaseId);
        j.setTotalCount(0);
        j.setDoneCount(0);
        j.setPassCount(0);
        j.setFailCount(0);
        j.setInconclusiveCount(0);
        return j;
    }

    private TestResultEntity phaseResult(Long tcId, RunResultStatus status) {
        TestCaseEntity tc = new TestCaseEntity();
        tc.setId(tcId);
        TestResultEntity r = new TestResultEntity();
        r.setTestCase(tc);
        r.setStatus(status);
        return r;
    }

    // --- submitJob ---

    @Test
    void submitJob_single_setsTotalOne() {
        when(jobRepository.save(any())).thenAnswer(inv -> {
            AgentExecutionJobEntity j = inv.getArgument(0);
            j.setId(1L);
            return j;
        });
        var req = new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.SINGLE, 10L, null, 5L, "tester");

        Long id = service.submitJob(req);

        assertThat(id).isEqualTo(1L);
        ArgumentCaptor<AgentExecutionJobEntity> cap = ArgumentCaptor.forClass(AgentExecutionJobEntity.class);
        verify(jobRepository).save(cap.capture());
        assertThat(cap.getValue().getTotalCount()).isEqualTo(1);
        assertThat(cap.getValue().getStatus()).isEqualTo(AgentExecutionStatus.PENDING);
    }

    @Test
    void submitJob_single_missingTargetTc_throws() {
        var req = new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.SINGLE, 10L, null, null, null);
        assertThatThrownBy(() -> service.submitJob(req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void submitJob_phaseUntested_setsResolvedCount() {
        when(testResultRepository.findAllByVersionPhaseId(99L)).thenReturn(List.of(
                phaseResult(1L, RunResultStatus.UNTESTED),
                phaseResult(2L, RunResultStatus.UNTESTED),
                phaseResult(3L, RunResultStatus.PASS)));
        when(jobRepository.save(any())).thenAnswer(inv -> {
            AgentExecutionJobEntity j = inv.getArgument(0);
            j.setId(2L);
            return j;
        });
        var req = new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.PHASE_UNTESTED, 10L, 99L, null, null);

        service.submitJob(req);

        ArgumentCaptor<AgentExecutionJobEntity> cap = ArgumentCaptor.forClass(AgentExecutionJobEntity.class);
        verify(jobRepository).save(cap.capture());
        assertThat(cap.getValue().getTotalCount()).isEqualTo(2); // only UNTESTED
    }

    @Test
    void submitJob_phase_missingPhaseId_throws() {
        var req = new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.PHASE_ALL, 10L, null, null, null);
        assertThatThrownBy(() -> service.submitJob(req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // --- claimJob ---

    @Test
    void claimJob_pending_transitionsToRunning() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.PENDING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var res = service.claimJob(1L);

        assertThat(res.status()).isEqualTo(AgentExecutionStatus.RUNNING);
    }

    @Test
    void claimJob_running_isIdempotent() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));

        var res = service.claimJob(1L);

        assertThat(res.status()).isEqualTo(AgentExecutionStatus.RUNNING);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void claimJob_done_throws() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.DONE, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        assertThatThrownBy(() -> service.claimJob(1L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // --- recordResult ---

    @Test
    void recordResult_incrementsCounters() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.PHASE_ALL, AgentExecutionStatus.RUNNING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(resultRepository.save(any())).thenAnswer(inv -> {
            AgentExecutionResultEntity r = inv.getArgument(0);
            r.setId(50L);
            return r;
        });
        var req = new AgentExecutionDto.RecordResultRequest(
                7L, AgentVerdict.FAIL, null, "제품 결함", 1000L, 500);

        service.recordResult(1L, req);

        assertThat(j.getDoneCount()).isEqualTo(1);
        assertThat(j.getFailCount()).isEqualTo(1);
    }

    @Test
    void recordResult_notRunning_throws() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.PENDING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        var req = new AgentExecutionDto.RecordResultRequest(7L, AgentVerdict.PASS, null, null, null, null);
        assertThatThrownBy(() -> service.recordResult(1L, req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void recordResult_withPhase_autoRecordsTestResultAsAgent() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.PHASE_ALL, AgentExecutionStatus.RUNNING, 99L);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(resultRepository.save(any())).thenAnswer(inv -> {
            AgentExecutionResultEntity r = inv.getArgument(0);
            r.setId(50L);
            return r;
        });
        VersionPhaseEntity phase = new VersionPhaseEntity();
        phase.setId(99L);
        phase.setVersion(new VersionEntity());
        when(versionPhaseRepository.findById(99L)).thenReturn(Optional.of(phase));
        when(testResultRepository.findByVersionPhaseIdAndTestCaseId(99L, 7L)).thenReturn(Optional.empty());
        when(testCaseRepository.getReferenceById(7L)).thenReturn(new TestCaseEntity());

        // INCONCLUSIVE → RETEST 매핑 검증
        var req = new AgentExecutionDto.RecordResultRequest(
                7L, AgentVerdict.INCONCLUSIVE, null, "판정불가", 100L, 10);
        service.recordResult(1L, req);

        ArgumentCaptor<TestResultEntity> cap = ArgumentCaptor.forClass(TestResultEntity.class);
        verify(testResultRepository).save(cap.capture());
        TestResultEntity saved = cap.getValue();
        assertThat(saved.getExecutedBy()).isEqualTo(ExecutedBy.AGENT);
        assertThat(saved.getStatus()).isEqualTo(RunResultStatus.RETEST);
        assertThat(saved.getAgentExecutionResultId()).isEqualTo(50L);
    }

    @Test
    void recordResult_singleDryRun_doesNotRecordTestResult() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(resultRepository.save(any())).thenAnswer(inv -> {
            AgentExecutionResultEntity r = inv.getArgument(0);
            r.setId(50L);
            return r;
        });
        var req = new AgentExecutionDto.RecordResultRequest(7L, AgentVerdict.PASS, null, null, null, null);

        service.recordResult(1L, req);

        verify(testResultRepository, never()).save(any());
        verify(versionPhaseRepository, never()).findById(any());
    }

    // --- completeJob ---

    @Test
    void completeJob_invalidStatus_throws() {
        var req = new AgentExecutionDto.CompleteJobRequest(AgentExecutionStatus.RUNNING, null);
        assertThatThrownBy(() -> service.completeJob(1L, req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void completeJob_done_setsStatusAndCompletedAt() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var res = service.completeJob(1L, new AgentExecutionDto.CompleteJobRequest(AgentExecutionStatus.DONE, null));

        assertThat(res.status()).isEqualTo(AgentExecutionStatus.DONE);
        assertThat(res.completedAt()).isNotNull();
    }

    // --- getExecutionContext ---

    @Test
    void getExecutionContext_phasePrevFail_resolvesOnlyFailedTcs() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.PHASE_PREV_FAIL, AgentExecutionStatus.RUNNING, 99L);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        ProductEntity product = new ProductEntity();
        product.setExecBaseUrl("http://x");
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        when(testResultRepository.findAllByVersionPhaseId(99L)).thenReturn(List.of(
                phaseResult(1L, RunResultStatus.FAIL),
                phaseResult(2L, RunResultStatus.PASS)));
        TestCaseEntity tc1 = new TestCaseEntity();
        tc1.setId(1L);
        when(testCaseRepository.findById(1L)).thenReturn(Optional.of(tc1));

        var ctx = service.getExecutionContext(1L);

        assertThat(ctx.testCases()).hasSize(1);
        assertThat(ctx.testCases().get(0).id()).isEqualTo(1L);
    }

    @Test
    void getExecutionContext_single_resolvesSegmentPathToNames() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        j.setTargetTestCaseId(7L);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(productRepository.findById(10L)).thenReturn(Optional.of(new ProductEntity()));

        TestCaseEntity tc = new TestCaseEntity();
        tc.setId(7L);
        tc.setPath(new Long[] {100L, 200L});
        when(testCaseRepository.findById(7L)).thenReturn(Optional.of(tc));
        when(segmentRepository.findById(100L)).thenReturn(Optional.of(segment("검색창")));
        when(segmentRepository.findById(200L)).thenReturn(Optional.of(segment("나와 가까운 매장 목록")));

        var ctx = service.getExecutionContext(1L);

        // Segment 경로가 곧 TC의 전제조건이므로 루트→말단 순의 이름으로 워커에 전달되어야 한다
        assertThat(ctx.testCases().get(0).segmentPath())
                .containsExactly("검색창", "나와 가까운 매장 목록");
    }

    @Test
    void getExecutionContext_single_emptyPathYieldsEmptySegmentPath() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        j.setTargetTestCaseId(7L);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(productRepository.findById(10L)).thenReturn(Optional.of(new ProductEntity()));

        TestCaseEntity tc = new TestCaseEntity();
        tc.setId(7L);
        when(testCaseRepository.findById(7L)).thenReturn(Optional.of(tc));

        var ctx = service.getExecutionContext(1L);

        assertThat(ctx.testCases().get(0).segmentPath()).isEmpty();
    }

    private SegmentEntity segment(String name) {
        SegmentEntity s = new SegmentEntity();
        s.setName(name);
        return s;
    }
}
