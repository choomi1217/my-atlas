package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/**
 * {@link AgentExecutionService} 구현.
 * 폴링 모델이라 in-process 비동기 워커가 없다 — Spring은 Job 생명주기만 관리하고
 * 실제 브라우저 실행은 외부 워커가 claim/record/complete 로 보고한다.
 */
@Service
@RequiredArgsConstructor
public class AgentExecutionServiceImpl implements AgentExecutionService {

    private static final Logger log = LoggerFactory.getLogger(AgentExecutionServiceImpl.class);

    private final AgentExecutionJobRepository jobRepository;
    private final AgentExecutionResultRepository resultRepository;
    private final TestCaseRepository testCaseRepository;
    private final ProductRepository productRepository;
    private final VersionPhaseRepository versionPhaseRepository;
    private final TestResultRepository testResultRepository;
    private final SegmentRepository segmentRepository;

    @Override
    @Transactional
    public Long submitJob(AgentExecutionDto.CreateJobRequest request) {
        validateTarget(request);

        AgentExecutionJobEntity job = new AgentExecutionJobEntity();
        job.setProductId(request.productId());
        job.setScope(request.scope());
        job.setPhaseId(request.phaseId());
        job.setTargetTestCaseId(request.targetTestCaseId());
        job.setRequestedBy(request.requestedBy());
        job.setStatus(AgentExecutionStatus.PENDING);
        // SINGLE은 대상 1건, PHASE_* 는 scope에 맞는 TC 수를 미리 계산
        job.setTotalCount(request.scope() == AgentExecutionScope.SINGLE
                ? 1
                : resolvePhaseTestCaseIds(request.phaseId(), request.scope()).size());

        Long id = jobRepository.save(job).getId();
        log.info("AgentExecution job created: id={}, scope={}, productId={}", id, request.scope(), request.productId());
        return id;
    }

    @Override
    @Transactional(readOnly = true)
    public AgentExecutionDto.JobResponse getJob(Long jobId) {
        AgentExecutionJobEntity job = findJob(jobId);
        return AgentExecutionDto.JobResponse.from(job, execTargetKindOf(job.getProductId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AgentExecutionDto.JobResponse> listByProduct(Long productId) {
        ExecTargetKind kind = execTargetKindOf(productId);
        return jobRepository.findAllByProductIdOrderByCreatedAtDesc(productId).stream()
                .map(j -> AgentExecutionDto.JobResponse.from(j, kind))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AgentExecutionDto.JobResponse> listByPhase(Long phaseId) {
        return jobRepository.findAllByPhaseIdOrderByCreatedAtDesc(phaseId).stream()
                .map(j -> AgentExecutionDto.JobResponse.from(j, execTargetKindOf(j.getProductId())))
                .toList();
    }

    @Override
    @Transactional
    public AgentExecutionDto.JobResponse cancelJob(Long jobId) {
        AgentExecutionJobEntity job = findJob(jobId);
        if (job.getStatus() != AgentExecutionStatus.PENDING && job.getStatus() != AgentExecutionStatus.RUNNING) {
            throw new IllegalArgumentException("취소할 수 없는 상태입니다: " + job.getStatus());
        }
        job.setStatus(AgentExecutionStatus.CANCELLED);
        job.setCompletedAt(LocalDateTime.now());
        return AgentExecutionDto.JobResponse.from(jobRepository.save(job));
    }

    @Override
    @Transactional(readOnly = true)
    public AgentExecutionDto.ResultResponse getResult(Long jobId, Long testCaseId) {
        AgentExecutionResultEntity result = resultRepository.findByJobIdAndTestCaseId(jobId, testCaseId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AgentExecution result not found: jobId=" + jobId + ", testCaseId=" + testCaseId));
        return AgentExecutionDto.ResultResponse.from(result);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AgentExecutionDto.ResultResponse> listResults(Long jobId) {
        return resultRepository.findAllByJobId(jobId).stream()
                .map(AgentExecutionDto.ResultResponse::from)
                .toList();
    }

    @Override
    @Transactional
    public AgentExecutionDto.JobResponse claimJob(Long jobId) {
        AgentExecutionJobEntity job = findJob(jobId);
        switch (job.getStatus()) {
            case PENDING -> {
                job.setStatus(AgentExecutionStatus.RUNNING);
                jobRepository.save(job);
                log.info("AgentExecution job claimed: id={}", jobId);
            }
            case RUNNING -> { /* 이미 점유됨 — 현재 상태 그대로 반환 (idempotent) */ }
            default -> throw new IllegalArgumentException("점유할 수 없는 상태입니다: " + job.getStatus());
        }
        return AgentExecutionDto.JobResponse.from(job);
    }

    @Override
    @Transactional
    public AgentExecutionDto.ResultResponse recordResult(Long jobId, AgentExecutionDto.RecordResultRequest request) {
        AgentExecutionJobEntity job = findJob(jobId);
        if (job.getStatus() != AgentExecutionStatus.RUNNING) {
            throw new IllegalArgumentException("실행 중(RUNNING) Job에만 결과를 보고할 수 있습니다: " + job.getStatus());
        }

        AgentExecutionResultEntity result = new AgentExecutionResultEntity();
        result.setJobId(jobId);
        result.setTestCaseId(request.testCaseId());
        result.setVerdict(request.verdict());
        result.setStepLogs(request.stepLogs());
        result.setAiFailureAnalysis(request.aiFailureAnalysis());
        result.setDurationMs(request.durationMs());
        result.setTokenCost(request.tokenCost());
        AgentExecutionResultEntity saved = resultRepository.save(result);

        job.setDoneCount(job.getDoneCount() + 1);
        switch (request.verdict()) {
            case PASS -> job.setPassCount(job.getPassCount() + 1);
            case FAIL -> job.setFailCount(job.getFailCount() + 1);
            case INCONCLUSIVE -> job.setInconclusiveCount(job.getInconclusiveCount() + 1);
        }
        jobRepository.save(job);

        // Phase 일괄 실행이면 TestResult에 자동 기록 (executed_by=AGENT). 단건 dry run(phaseId=null)은 미기록.
        if (job.getPhaseId() != null) {
            upsertAgentTestResult(job.getPhaseId(), request, saved.getId());
        }

        return AgentExecutionDto.ResultResponse.from(saved);
    }

    @Override
    @Transactional
    public AgentExecutionDto.JobResponse completeJob(Long jobId, AgentExecutionDto.CompleteJobRequest request) {
        if (request.status() != AgentExecutionStatus.DONE && request.status() != AgentExecutionStatus.FAILED) {
            throw new IllegalArgumentException("종료 상태는 DONE 또는 FAILED만 허용됩니다: " + request.status());
        }
        AgentExecutionJobEntity job = findJob(jobId);
        job.setStatus(request.status());
        if (request.status() == AgentExecutionStatus.FAILED) {
            job.setErrorMessage(request.errorMessage());
        }
        job.setCompletedAt(LocalDateTime.now());
        return AgentExecutionDto.JobResponse.from(jobRepository.save(job));
    }

    @Override
    @Transactional(readOnly = true)
    public AgentExecutionDto.WorkerContextResponse getExecutionContext(Long jobId) {
        AgentExecutionJobEntity job = findJob(jobId);
        ProductEntity product = productRepository.findById(job.getProductId())
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + job.getProductId()));

        List<AgentExecutionDto.TestCaseContext> testCases;
        if (job.getScope() == AgentExecutionScope.SINGLE) {
            TestCaseEntity tc = testCaseRepository.findById(job.getTargetTestCaseId())
                    .orElseThrow(() -> new EntityNotFoundException("TestCase not found: " + job.getTargetTestCaseId()));
            testCases = List.of(AgentExecutionDto.TestCaseContext.from(tc, resolveSegmentNames(tc)));
        } else {
            // PHASE_* : scope에 맞는 phase의 TC 목록을 해석
            testCases = resolvePhaseTestCaseIds(job.getPhaseId(), job.getScope()).stream()
                    .map(id -> testCaseRepository.findById(id).orElse(null))
                    .filter(Objects::nonNull)
                    .map(tc -> AgentExecutionDto.TestCaseContext.from(tc, resolveSegmentNames(tc)))
                    .toList();
        }

        return new AgentExecutionDto.WorkerContextResponse(
                job.getId(), job.getScope(), product.getExecTargetKind(),
                product.getExecBaseUrl(), product.getExecSeedNote(), testCases);
    }

    /** 제품이 선언한 실행 대상 종류. 제품을 못 찾으면 기존 동작(WEB)으로 본다. */
    private ExecTargetKind execTargetKindOf(Long productId) {
        return productRepository.findById(productId)
                .map(ProductEntity::getExecTargetKind)
                .orElse(ExecTargetKind.WEB);
    }

    /**
     * TC의 Segment 경로를 루트→말단 순의 이름 목록으로 해석한다.
     * <p>
     * Registry에서는 TC가 놓인 Segment 경로가 곧 전제조건을 선언한다
     * (예: {@code 검색창 > 검색 전 화면 > 나와 가까운 매장 목록}).
     * 에이전트가 TC step을 실행하기 전에 그 화면까지 이동해야 하므로 반드시 함께 넘긴다.
     * ID 배열로는 에이전트가 아무것도 할 수 없어 이름으로 해석한다.
     *
     * @return 해석된 이름 목록. path가 비었거나 세그먼트가 삭제됐으면 빈 목록
     */
    private List<String> resolveSegmentNames(TestCaseEntity tc) {
        Long[] path = tc.getPath();
        if (path == null || path.length == 0) {
            return List.of();
        }
        return Arrays.stream(path)
                .filter(Objects::nonNull)
                .map(id -> segmentRepository.findById(id).map(SegmentEntity::getName).orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    /**
     * Phase의 TC 목록을 scope에 맞춰 해석한다.
     * Phase 생성 시 TC별로 test_result(UNTESTED)가 materialize 되므로 그 행을 기준으로 필터한다.
     */
    private List<Long> resolvePhaseTestCaseIds(Long phaseId, AgentExecutionScope scope) {
        return testResultRepository.findAllByVersionPhaseId(phaseId).stream()
                .filter(r -> switch (scope) {
                    case PHASE_ALL -> true;
                    case PHASE_UNTESTED -> r.getStatus() == RunResultStatus.UNTESTED;
                    case PHASE_PREV_FAIL -> r.getStatus() == RunResultStatus.FAIL;
                    default -> false;
                })
                .map(r -> r.getTestCase().getId())
                .distinct()
                .toList();
    }

    /**
     * 에이전트 실행 결과를 TestResult에 upsert (executed_by=AGENT, 증적 역참조).
     * INCONCLUSIVE → RETEST 로 매핑되어 사람 확인 대기열이 된다.
     */
    private void upsertAgentTestResult(Long phaseId, AgentExecutionDto.RecordResultRequest request, Long agentResultId) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new EntityNotFoundException("VersionPhase not found: " + phaseId));
        TestResultEntity tr = testResultRepository
                .findByVersionPhaseIdAndTestCaseId(phaseId, request.testCaseId())
                .orElseGet(() -> {
                    TestResultEntity n = new TestResultEntity();
                    n.setVersion(phase.getVersion());
                    n.setVersionPhase(phase);
                    n.setTestCase(testCaseRepository.getReferenceById(request.testCaseId()));
                    return n;
                });
        tr.setStatus(mapVerdictToStatus(request.verdict()));
        tr.setExecutedBy(ExecutedBy.AGENT);
        tr.setAgentExecutionResultId(agentResultId);
        tr.setExecutedAt(LocalDateTime.now());
        if (request.aiFailureAnalysis() != null && !request.aiFailureAnalysis().isBlank()) {
            tr.setComment(request.aiFailureAnalysis());
        }
        testResultRepository.save(tr);
    }

    private RunResultStatus mapVerdictToStatus(AgentVerdict verdict) {
        return switch (verdict) {
            case PASS -> RunResultStatus.PASS;
            case FAIL -> RunResultStatus.FAIL;
            case INCONCLUSIVE -> RunResultStatus.RETEST;
        };
    }

    private AgentExecutionJobEntity findJob(Long jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new EntityNotFoundException("AgentExecution job not found: " + jobId));
    }

    private void validateTarget(AgentExecutionDto.CreateJobRequest request) {
        if (request.scope() == AgentExecutionScope.SINGLE) {
            if (request.targetTestCaseId() == null) {
                throw new IllegalArgumentException("SINGLE scope는 targetTestCaseId가 필요합니다");
            }
        } else if (request.phaseId() == null) {
            throw new IllegalArgumentException(request.scope() + " scope는 phaseId가 필요합니다");
        }
    }
}
