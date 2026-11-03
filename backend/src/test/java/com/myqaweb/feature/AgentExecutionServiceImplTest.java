package com.myqaweb.feature;

import com.myqaweb.common.ConflictException;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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
    @Mock private VersionRepository versionRepository;
    @Mock private AgentLiveFrameStore frameStore;
    @Mock private AgentWorkerRegistry workerRegistry;
    @Mock private AgentStepScreenshotRepository screenshotRepository;

    @InjectMocks private AgentExecutionServiceImpl service;

    private static final List<AgentExecutionStatus> ACTIVE =
            List.of(AgentExecutionStatus.PENDING, AgentExecutionStatus.RUNNING);

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

    private AgentExecutionJobEntity activeJob(Long id, Long... testCaseIds) {
        AgentExecutionJobEntity j = job(id, AgentExecutionScope.PHASE_ALL, AgentExecutionStatus.RUNNING, 99L);
        j.setTestCaseIds(testCaseIds);
        return j;
    }

    private void stubJobSave() {
        when(jobRepository.save(any())).thenAnswer(inv -> {
            AgentExecutionJobEntity j = inv.getArgument(0);
            j.setId(1L);
            return j;
        });
    }

    private AgentExecutionJobEntity savedJob() {
        ArgumentCaptor<AgentExecutionJobEntity> cap = ArgumentCaptor.forClass(AgentExecutionJobEntity.class);
        verify(jobRepository).save(cap.capture());
        return cap.getValue();
    }

    private void stubPhaseMembers(Long... testCaseIds) {
        when(testResultRepository.findAllByVersionPhaseId(99L)).thenReturn(
                Arrays.stream(testCaseIds).map(id -> phaseResult(id, RunResultStatus.UNTESTED)).toList());
    }

    private AgentExecutionDto.CreateJobRequest selected(Long phaseId, List<Long> testCaseIds) {
        return new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.PHASE_SELECTED, 10L, phaseId, null, null, testCaseIds);
    }

    private AgentExecutionDto.CreateJobRequest phaseAll() {
        return new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.PHASE_ALL, 10L, 99L, null, null, null);
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
                AgentExecutionScope.SINGLE, 10L, null, 5L, "tester", null);

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
                AgentExecutionScope.SINGLE, 10L, null, null, null, null);
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
                AgentExecutionScope.PHASE_UNTESTED, 10L, 99L, null, null, null);

        service.submitJob(req);

        ArgumentCaptor<AgentExecutionJobEntity> cap = ArgumentCaptor.forClass(AgentExecutionJobEntity.class);
        verify(jobRepository).save(cap.capture());
        assertThat(cap.getValue().getTotalCount()).isEqualTo(2); // only UNTESTED
    }

    @Test
    void submitJob_phaseUntested_noMatchingTestCases_throwsAndSavesNothing() {
        when(testResultRepository.findAllByVersionPhaseId(99L)).thenReturn(List.of(
                phaseResult(1L, RunResultStatus.PASS)));
        var req = new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.PHASE_UNTESTED, 10L, 99L, null, null, null);

        assertThatThrownBy(() -> service.submitJob(req))
                .isInstanceOf(IllegalArgumentException.class);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void submitJob_phase_missingPhaseId_throws() {
        var req = new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.PHASE_ALL, 10L, null, null, null, null);
        assertThatThrownBy(() -> service.submitJob(req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void submitJob_single_persistsTargetAsTestCaseIds() {
        stubJobSave();

        service.submitJob(new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.SINGLE, 10L, null, 5L, null, null));

        AgentExecutionJobEntity saved = savedJob();
        assertThat(saved.getTestCaseIds()).containsExactly(5L);
        assertThat(saved.getTotalCount()).isEqualTo(1);
    }

    @Test
    void submitJob_phaseAll_persistsDistinctPhaseTestCaseIds() {
        when(testResultRepository.findAllByVersionPhaseId(99L)).thenReturn(List.of(
                phaseResult(1L, RunResultStatus.UNTESTED),
                phaseResult(2L, RunResultStatus.PASS),
                phaseResult(2L, RunResultStatus.FAIL)));
        stubJobSave();

        service.submitJob(phaseAll());

        AgentExecutionJobEntity saved = savedJob();
        assertThat(saved.getTestCaseIds()).containsExactly(1L, 2L);
        assertThat(saved.getTotalCount()).isEqualTo(2);
    }

    @Test
    void submitJob_phaseSelected_persistsRequestedIdsInOrder() {
        stubPhaseMembers(1L, 2L, 3L);
        stubJobSave();

        service.submitJob(selected(99L, List.of(3L, 1L)));

        AgentExecutionJobEntity saved = savedJob();
        assertThat(saved.getScope()).isEqualTo(AgentExecutionScope.PHASE_SELECTED);
        assertThat(saved.getTestCaseIds()).containsExactly(3L, 1L);
        assertThat(saved.getTotalCount()).isEqualTo(2);
    }

    @Test
    void submitJob_phaseSelected_deduplicatesIds() {
        stubPhaseMembers(2L, 3L);
        stubJobSave();

        service.submitJob(selected(99L, List.of(2L, 2L, 3L, 2L)));

        AgentExecutionJobEntity saved = savedJob();
        assertThat(saved.getTestCaseIds()).containsExactly(2L, 3L);
        assertThat(saved.getTotalCount()).isEqualTo(2);
    }

    @Test
    void submitJob_phaseSelected_missingPhaseId_throws() {
        assertThatThrownBy(() -> service.submitJob(selected(null, List.of(1L))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(jobRepository, never()).save(any());
    }

    @ParameterizedTest
    @NullAndEmptySource
    void submitJob_phaseSelected_noTestCaseIds_throws(List<Long> testCaseIds) {
        assertThatThrownBy(() -> service.submitJob(selected(99L, testCaseIds)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void submitJob_phaseSelected_idOutsidePhase_throws() {
        stubPhaseMembers(1L, 2L);

        assertThatThrownBy(() -> service.submitJob(selected(99L, List.of(2L, 9L))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(jobRepository, never()).save(any());
    }

    // --- submitJob: 같은 Phase의 대기·실행 중 Job과 TC 중복 방지 ---

    @Test
    void submitJob_overlappingActiveJob_throwsConflict() {
        stubPhaseMembers(1L, 2L);
        when(jobRepository.findAllByPhaseIdAndStatusIn(99L, ACTIVE)).thenReturn(List.of(activeJob(7L, 2L, 5L)));

        assertThatThrownBy(() -> service.submitJob(phaseAll()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("#7");
        verify(jobRepository, never()).save(any());
    }

    @Test
    void submitJob_phaseSelected_overlappingActiveJob_throwsConflict() {
        stubPhaseMembers(1L, 2L);
        when(jobRepository.findAllByPhaseIdAndStatusIn(99L, ACTIVE)).thenReturn(List.of(activeJob(7L, 1L)));

        assertThatThrownBy(() -> service.submitJob(selected(99L, List.of(1L))))
                .isInstanceOf(ConflictException.class);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void submitJob_nonOverlappingActiveJob_isCreated() {
        stubPhaseMembers(1L, 2L);
        when(jobRepository.findAllByPhaseIdAndStatusIn(99L, ACTIVE)).thenReturn(List.of(activeJob(7L, 8L, 9L)));
        stubJobSave();

        assertThat(service.submitJob(phaseAll())).isEqualTo(1L);
    }

    @Test
    void submitJob_activeJobWithNullTestCaseIds_countsAsOverlapping() {
        stubPhaseMembers(1L);
        when(jobRepository.findAllByPhaseIdAndStatusIn(99L, ACTIVE))
                .thenReturn(List.of(activeJob(7L, (Long[]) null)));

        assertThatThrownBy(() -> service.submitJob(phaseAll()))
                .isInstanceOf(ConflictException.class);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void submitJob_nullPhaseId_skipsOverlapGuard() {
        stubJobSave();

        service.submitJob(new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.SINGLE, 10L, null, 5L, null, null));

        verify(jobRepository, never()).findAllByPhaseIdAndStatusIn(any(), any());
    }

    // --- listQueue ---

    private AgentExecutionDto.JobPageResponse listQueue(List<AgentExecutionJobEntity> jobs) {
        when(jobRepository.findAllByStatusIn(eq(ACTIVE), any(Pageable.class))).thenReturn(new PageImpl<>(jobs));
        return service.listQueue(ACTIVE, 0, 30, Sort.Direction.DESC);
    }

    private ProductEntity product(Long id, String name, ExecTargetKind kind) {
        CompanyEntity company = new CompanyEntity();
        company.setId(1L);
        ProductEntity p = new ProductEntity();
        p.setId(id);
        p.setName(name);
        p.setCompany(company);
        p.setExecTargetKind(kind);
        return p;
    }

    private VersionPhaseEntity phase(Long id, String name, VersionEntity version) {
        VersionPhaseEntity p = new VersionPhaseEntity();
        p.setId(id);
        p.setPhaseName(name);
        p.setVersion(version);
        return p;
    }

    private VersionEntity version(Long id, String name) {
        VersionEntity v = new VersionEntity();
        v.setId(id);
        v.setName(name);
        return v;
    }

    private TestCaseEntity testCase(Long id, String title) {
        TestCaseEntity tc = new TestCaseEntity();
        tc.setId(id);
        tc.setTitle(title);
        return tc;
    }

    @Test
    void listQueue_mapsNamesAndLinkIds() {
        when(productRepository.findAllById(any()))
                .thenReturn(List.of(product(10L, "패스오더", ExecTargetKind.ANDROID)));
        VersionEntity v = version(5L, "v1.0");
        when(versionPhaseRepository.findAllById(any())).thenReturn(List.of(phase(99L, "1차", v)));
        when(versionRepository.findAllById(any())).thenReturn(List.of(v));
        when(testCaseRepository.findAllById(any())).thenReturn(List.of(testCase(7L, "로그인")));
        AgentExecutionJobEntity single = job(2L, AgentExecutionScope.SINGLE, AgentExecutionStatus.DONE, null);
        single.setTargetTestCaseId(7L);

        var res = listQueue(List.of(
                job(1L, AgentExecutionScope.PHASE_ALL, AgentExecutionStatus.RUNNING, 99L), single));

        var phaseItem = res.items().get(0);
        assertThat(phaseItem.job().id()).isEqualTo(1L);
        assertThat(phaseItem.job().execTargetKind()).isEqualTo(ExecTargetKind.ANDROID);
        assertThat(phaseItem.productName()).isEqualTo("패스오더");
        assertThat(phaseItem.companyId()).isEqualTo(1L);
        assertThat(phaseItem.phaseName()).isEqualTo("1차");
        assertThat(phaseItem.versionId()).isEqualTo(5L);
        assertThat(phaseItem.versionName()).isEqualTo("v1.0");
        assertThat(phaseItem.testCaseTitle()).isNull();

        var singleItem = res.items().get(1);
        assertThat(singleItem.testCaseTitle()).isEqualTo("로그인");
        assertThat(singleItem.phaseName()).isNull();
        assertThat(singleItem.versionId()).isNull();
        assertThat(singleItem.versionName()).isNull();
    }

    @Test
    void listQueue_deletedProduct_yieldsNullNamesAndWebKind() {
        var res = listQueue(List.of(job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.PENDING, null)));

        var item = res.items().get(0);
        assertThat(item.productName()).isNull();
        assertThat(item.companyId()).isNull();
        assertThat(item.job().execTargetKind()).isEqualTo(ExecTargetKind.WEB);
    }

    @Test
    void listQueue_looksUpNamesInBatchWithoutPerRowQueries() {
        VersionEntity v = version(5L, "v1.0");
        when(versionPhaseRepository.findAllById(any())).thenReturn(List.of(phase(99L, "1차", v)));
        AgentExecutionJobEntity otherProduct = job(2L, AgentExecutionScope.PHASE_ALL, AgentExecutionStatus.RUNNING, 99L);
        otherProduct.setProductId(11L);
        AgentExecutionJobEntity single = job(3L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        single.setTargetTestCaseId(7L);

        listQueue(List.of(
                job(1L, AgentExecutionScope.PHASE_ALL, AgentExecutionStatus.RUNNING, 99L), otherProduct, single));

        verify(productRepository, times(1)).findAllById(Set.of(10L, 11L));
        verify(versionPhaseRepository, times(1)).findAllById(Set.of(99L));
        verify(versionRepository, times(1)).findAllById(Set.of(5L));
        verify(testCaseRepository, times(1)).findAllById(Set.of(7L));
        verify(productRepository, never()).findById(any());
        verify(versionPhaseRepository, never()).findById(any());
        verify(versionRepository, never()).findById(any());
        verify(testCaseRepository, never()).findById(any());
    }

    @Test
    void listQueue_returnsPagingMetadata() {
        when(jobRepository.findAllByStatusIn(eq(ACTIVE), any(Pageable.class))).thenReturn(new PageImpl<>(
                List.of(job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.PENDING, null)),
                PageRequest.of(0, 20), 45));

        var res = service.listQueue(ACTIVE, 0, 20, Sort.Direction.DESC);

        assertThat(res.totalElements()).isEqualTo(45);
        assertThat(res.page()).isZero();
        assertThat(res.totalPages()).isEqualTo(3);
    }

    @ParameterizedTest
    @CsvSource({"500,100", "101,100", "100,100", "30,30", "0,1", "-5,1"})
    void listQueue_clampsPageSize(int requested, int expected) {
        when(jobRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        service.listQueue(null, 0, requested, Sort.Direction.DESC);

        ArgumentCaptor<Pageable> cap = ArgumentCaptor.forClass(Pageable.class);
        verify(jobRepository).findAll(cap.capture());
        assertThat(cap.getValue().getPageSize()).isEqualTo(expected);
    }

    @Test
    void listQueue_negativePage_usesFirstPageAndRequestedDirection() {
        when(jobRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        service.listQueue(null, -1, 30, Sort.Direction.ASC);

        ArgumentCaptor<Pageable> cap = ArgumentCaptor.forClass(Pageable.class);
        verify(jobRepository).findAll(cap.capture());
        assertThat(cap.getValue().getPageNumber()).isZero();
        assertThat(cap.getValue().getSort().getOrderFor("createdAt").getDirection()).isEqualTo(Sort.Direction.ASC);
    }

    @ParameterizedTest
    @NullAndEmptySource
    void listQueue_noStatuses_usesFindAll(List<AgentExecutionStatus> statuses) {
        when(jobRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        service.listQueue(statuses, 0, 30, Sort.Direction.DESC);

        verify(jobRepository, never()).findAllByStatusIn(any(), any());
    }

    // --- claimJob ---

    @Test
    void claimJob_pending_transitionsToRunning() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.PENDING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var res = service.claimJob(1L, "host:web");

        assertThat(res.status()).isEqualTo(AgentExecutionStatus.RUNNING);
    }

    @Test
    void claimJob_pending_recordsStartedAtAndWorkerId() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.PENDING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        LocalDateTime before = LocalDateTime.now();

        var res = service.claimJob(1L, "host:web");

        assertThat(res.startedAt()).isAfterOrEqualTo(before);
        assertThat(res.workerId()).isEqualTo("host:web");
    }

    @Test
    void claimJob_pending_withoutWorkerId_stillClaims() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.PENDING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var res = service.claimJob(1L, null);

        assertThat(res.status()).isEqualTo(AgentExecutionStatus.RUNNING);
        assertThat(res.startedAt()).isNotNull();
        assertThat(res.workerId()).isNull();
    }

    @Test
    void claimJob_running_isIdempotent() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));

        var res = service.claimJob(1L, "host:web");

        assertThat(res.status()).isEqualTo(AgentExecutionStatus.RUNNING);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void claimJob_running_doesNotOverwriteStartedAtOrWorkerId() {
        LocalDateTime startedAt = LocalDateTime.of(2026, 11, 1, 9, 0);
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        j.setStartedAt(startedAt);
        j.setWorkerId("first");
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));

        var res = service.claimJob(1L, "second");

        assertThat(res.startedAt()).isEqualTo(startedAt);
        assertThat(res.workerId()).isEqualTo("first");
    }

    @Test
    void claimJob_done_throws() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.DONE, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        assertThatThrownBy(() -> service.claimJob(1L, "host:web"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(j.getStartedAt()).isNull();
        assertThat(j.getWorkerId()).isNull();
    }

    // --- 워커 heartbeat ---

    @Test
    void heartbeat_delegatesToRegistry() {
        var req = new AgentExecutionDto.WorkerHeartbeatRequest("host:web", ExecTargetKind.WEB, null, null, null);

        service.heartbeat(req);

        verify(workerRegistry).put(req);
    }

    @Test
    void listWorkers_delegatesToRegistry() {
        var worker = new AgentExecutionDto.WorkerStatus(
                "host:web", ExecTargetKind.WEB, null, null, null, LocalDateTime.now());
        when(workerRegistry.listActive()).thenReturn(List.of(worker));

        assertThat(service.listWorkers()).containsExactly(worker);
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

    /** 재실행(PHASE_SELECTED) 결과는 사람이 입력한 Phase 결과도 덮어쓴다 (registry_v31 결정 #1). */
    private TestResultEntity recordOverHumanResult(String aiFailureAnalysis) {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.PHASE_SELECTED, AgentExecutionStatus.RUNNING, 99L);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(resultRepository.save(any())).thenAnswer(inv -> {
            AgentExecutionResultEntity r = inv.getArgument(0);
            r.setId(50L);
            return r;
        });
        VersionPhaseEntity phase = new VersionPhaseEntity();
        phase.setVersion(new VersionEntity());
        when(versionPhaseRepository.findById(99L)).thenReturn(Optional.of(phase));
        TestResultEntity human = new TestResultEntity();
        human.setStatus(RunResultStatus.PASS);
        human.setExecutedBy(ExecutedBy.HUMAN);
        human.setComment("사람 메모");
        when(testResultRepository.findByVersionPhaseIdAndTestCaseId(99L, 7L)).thenReturn(Optional.of(human));

        service.recordResult(1L, new AgentExecutionDto.RecordResultRequest(
                7L, AgentVerdict.FAIL, null, aiFailureAnalysis, 100L, 10));

        verify(testResultRepository).save(human);
        verify(testCaseRepository, never()).getReferenceById(any());
        return human;
    }

    @Test
    void recordResult_phaseSelected_overwritesHumanResult() {
        TestResultEntity saved = recordOverHumanResult("재실행 실패");

        assertThat(saved.getStatus()).isEqualTo(RunResultStatus.FAIL);
        assertThat(saved.getExecutedBy()).isEqualTo(ExecutedBy.AGENT);
        assertThat(saved.getAgentExecutionResultId()).isEqualTo(50L);
        assertThat(saved.getExecutedAt()).isNotNull();
        assertThat(saved.getComment()).isEqualTo("재실행 실패");
    }

    @Test
    void recordResult_phaseSelected_withoutAnalysis_keepsHumanComment() {
        TestResultEntity saved = recordOverHumanResult(null);

        assertThat(saved.getExecutedBy()).isEqualTo(ExecutedBy.AGENT);
        assertThat(saved.getComment()).isEqualTo("사람 메모");
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
        verify(frameStore).clear(1L);
    }

    // --- cancelJob ---

    @Test
    void cancelJob_running_cancelsAndClearsFrame() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var res = service.cancelJob(1L);

        assertThat(res.status()).isEqualTo(AgentExecutionStatus.CANCELLED);
        verify(frameStore).clear(1L);
    }

    @Test
    void cancelJob_returnsExecTargetKind() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.PENDING, null);
        ProductEntity product = new ProductEntity();
        product.setExecTargetKind(ExecTargetKind.ANDROID);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));

        assertThat(service.cancelJob(1L).execTargetKind()).isEqualTo(ExecTargetKind.ANDROID);
    }

    // --- storeFrame / getFrame (registry_v26) ---

    @Test
    void storeFrame_running_storesAndReturnsTrue() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        byte[] data = {1, 2, 3};

        boolean stored = service.storeFrame(1L, data, "image/png");

        assertThat(stored).isTrue();
        verify(frameStore).put(1L, data, "image/png");
    }

    @ParameterizedTest
    @EnumSource(value = AgentExecutionStatus.class, names = {"PENDING", "DONE", "FAILED", "CANCELLED"})
    void storeFrame_notRunning_returnsFalseAndDoesNotStore(AgentExecutionStatus status) {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, status, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));

        boolean stored = service.storeFrame(1L, new byte[] {1}, "image/png");

        assertThat(stored).isFalse();
        verify(frameStore, never()).put(any(), any(), any());
    }

    @Test
    void storeFrame_unknownJob_throwsNotFound() {
        when(jobRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.storeFrame(404L, new byte[] {1}, "image/png"))
                .isInstanceOf(EntityNotFoundException.class);
        verify(frameStore, never()).put(any(), any(), any());
    }

    @Test
    void getFrame_delegatesToStore() {
        var frame = new AgentLiveFrameStore.Frame(new byte[] {9}, "image/jpeg");
        when(frameStore.get(1L)).thenReturn(Optional.of(frame));
        when(frameStore.get(2L)).thenReturn(Optional.empty());

        assertThat(service.getFrame(1L)).containsSame(frame);
        assertThat(service.getFrame(2L)).isEmpty();
    }

    // --- storeProgress / getProgress (registry_v27) ---

    private static final AgentExecutionDto.LiveProgress PROGRESS = new AgentExecutionDto.LiveProgress(
            10L, "로그인", 1, 1, "ACTING", null, 1,
            List.of(new AgentExecutionDto.LiveStep(1, "클릭", "이동", "ACTING", null)));

    @Test
    void storeProgress_running_storesAndReturnsTrue() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));

        boolean stored = service.storeProgress(1L, PROGRESS);

        assertThat(stored).isTrue();
        verify(frameStore).putProgress(1L, PROGRESS);
    }

    @ParameterizedTest
    @EnumSource(value = AgentExecutionStatus.class, names = {"PENDING", "DONE", "FAILED", "CANCELLED"})
    void storeProgress_notRunning_returnsFalseAndDoesNotStore(AgentExecutionStatus status) {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.SINGLE, status, null);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));

        boolean stored = service.storeProgress(1L, PROGRESS);

        assertThat(stored).isFalse();
        verify(frameStore, never()).putProgress(any(), any());
    }

    @Test
    void storeProgress_unknownJob_throwsNotFound() {
        when(jobRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.storeProgress(404L, PROGRESS))
                .isInstanceOf(EntityNotFoundException.class);
        verify(frameStore, never()).putProgress(any(), any());
    }

    @Test
    void getProgress_delegatesToStore() {
        when(frameStore.getProgress(1L)).thenReturn(Optional.of(PROGRESS));
        when(frameStore.getProgress(2L)).thenReturn(Optional.empty());

        assertThat(service.getProgress(1L)).containsSame(PROGRESS);
        assertThat(service.getProgress(2L)).isEmpty();
    }

    // --- storeScreenshot / getScreenshot (registry_v31) ---

    private static byte[] png(int width, int height) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }

    private AgentStepScreenshotEntity storedScreenshot() {
        ArgumentCaptor<AgentStepScreenshotEntity> cap = ArgumentCaptor.forClass(AgentStepScreenshotEntity.class);
        verify(screenshotRepository).save(cap.capture());
        return cap.getValue();
    }

    @Test
    void storeScreenshot_newKey_convertsToJpegAndSaves() throws IOException {
        when(jobRepository.findById(1L)).thenReturn(Optional.of(
                job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null)));
        when(screenshotRepository.findByJobIdAndTestCaseIdAndStepOrder(1L, 7L, 2)).thenReturn(Optional.empty());

        service.storeScreenshot(1L, 7L, 2, png(10, 10), MediaType.IMAGE_PNG_VALUE);

        AgentStepScreenshotEntity saved = storedScreenshot();
        assertThat(saved.getJobId()).isEqualTo(1L);
        assertThat(saved.getTestCaseId()).isEqualTo(7L);
        assertThat(saved.getStepOrder()).isEqualTo(2);
        assertThat(saved.getContentType()).isEqualTo(MediaType.IMAGE_JPEG_VALUE);
        assertThat(saved.getData()).startsWith((byte) 0xFF, (byte) 0xD8);
    }

    @Test
    void storeScreenshot_sameKey_overwritesExistingRowAndRestartsRetention() throws IOException {
        LocalDateTime oldCreatedAt = LocalDateTime.of(2026, 1, 1, 0, 0);
        AgentStepScreenshotEntity existing = new AgentStepScreenshotEntity();
        existing.setId(33L);
        existing.setData(new byte[] {1});
        existing.setContentType(MediaType.IMAGE_PNG_VALUE);
        existing.setCreatedAt(oldCreatedAt);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(
                job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.DONE, null)));
        when(screenshotRepository.findByJobIdAndTestCaseIdAndStepOrder(1L, 7L, 2))
                .thenReturn(Optional.of(existing));

        service.storeScreenshot(1L, 7L, 2, png(10, 10), MediaType.IMAGE_PNG_VALUE);

        AgentStepScreenshotEntity saved = storedScreenshot();
        assertThat(saved).isSameAs(existing);
        assertThat(saved.getId()).isEqualTo(33L);
        assertThat(saved.getData()).startsWith((byte) 0xFF, (byte) 0xD8);
        assertThat(saved.getCreatedAt()).isAfter(oldCreatedAt);
    }

    @Test
    void storeScreenshot_garbageBytes_storesOriginalBytesAndContentType() {
        byte[] garbage = {1, 2, 3};
        when(jobRepository.findById(1L)).thenReturn(Optional.of(
                job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null)));

        service.storeScreenshot(1L, 7L, 2, garbage, MediaType.IMAGE_PNG_VALUE);

        AgentStepScreenshotEntity saved = storedScreenshot();
        assertThat(saved.getData()).isEqualTo(garbage);
        assertThat(saved.getContentType()).isEqualTo(MediaType.IMAGE_PNG_VALUE);
    }

    @Test
    void storeScreenshot_truncatedPng_storesOriginalBytesAndContentType() throws IOException {
        byte[] truncated = Arrays.copyOf(png(10, 10), 20);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(
                job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.RUNNING, null)));

        service.storeScreenshot(1L, 7L, 2, truncated, MediaType.IMAGE_PNG_VALUE);

        AgentStepScreenshotEntity saved = storedScreenshot();
        assertThat(saved.getData()).isEqualTo(truncated);
        assertThat(saved.getContentType()).isEqualTo(MediaType.IMAGE_PNG_VALUE);
    }

    @Test
    void storeScreenshot_unknownJob_throwsNotFound() {
        when(jobRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.storeScreenshot(404L, 7L, 2, new byte[] {1}, MediaType.IMAGE_PNG_VALUE))
                .isInstanceOf(EntityNotFoundException.class);
        verify(screenshotRepository, never()).save(any());
    }

    @Test
    void storeScreenshot_testCaseNotInJob_throwsAndSavesNothing() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.PHASE_SELECTED, AgentExecutionStatus.RUNNING, 99L);
        j.setTestCaseIds(new Long[] {7L});
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));

        assertThatThrownBy(() -> service.storeScreenshot(1L, 8L, 2, new byte[] {1}, MediaType.IMAGE_PNG_VALUE))
                .isInstanceOf(IllegalArgumentException.class);
        verify(screenshotRepository, never()).save(any());
    }

    @Test
    void getScreenshot_unknownJob_throwsNotFound() {
        when(jobRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getScreenshot(404L, 7L, 2))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void getScreenshot_delegatesToRepository() {
        var shot = new AgentStepScreenshotEntity();
        when(jobRepository.findById(1L)).thenReturn(Optional.of(
                job(1L, AgentExecutionScope.SINGLE, AgentExecutionStatus.DONE, null)));
        when(screenshotRepository.findByJobIdAndTestCaseIdAndStepOrder(1L, 7L, 2)).thenReturn(Optional.of(shot));

        assertThat(service.getScreenshot(1L, 7L, 2)).containsSame(shot);
    }

    // --- getExecutionContext ---

    @Test
    void getExecutionContext_withTestCaseIds_usesFixedOrderAndSkipsDeleted() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.PHASE_ALL, AgentExecutionStatus.RUNNING, 99L);
        j.setTestCaseIds(new Long[] {3L, 9L, 1L});
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(productRepository.findById(10L)).thenReturn(Optional.of(new ProductEntity()));
        when(testCaseRepository.findById(3L)).thenReturn(Optional.of(testCase(3L, "셋")));
        when(testCaseRepository.findById(9L)).thenReturn(Optional.empty());
        when(testCaseRepository.findById(1L)).thenReturn(Optional.of(testCase(1L, "하나")));

        var ctx = service.getExecutionContext(1L);

        assertThat(ctx.testCases()).extracting(AgentExecutionDto.TestCaseContext::id).containsExactly(3L, 1L);
        verify(testResultRepository, never()).findAllByVersionPhaseId(any());
    }

    @Test
    void getExecutionContext_nullTestCaseIds_fallsBackToPhaseResolution() {
        AgentExecutionJobEntity j = job(1L, AgentExecutionScope.PHASE_ALL, AgentExecutionStatus.RUNNING, 99L);
        when(jobRepository.findById(1L)).thenReturn(Optional.of(j));
        when(productRepository.findById(10L)).thenReturn(Optional.of(new ProductEntity()));
        stubPhaseMembers(1L);
        when(testCaseRepository.findById(1L)).thenReturn(Optional.of(testCase(1L, "하나")));

        var ctx = service.getExecutionContext(1L);

        assertThat(ctx.testCases()).extracting(AgentExecutionDto.TestCaseContext::id).containsExactly(1L);
        verify(testResultRepository).findAllByVersionPhaseId(99L);
    }

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
