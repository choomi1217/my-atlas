package com.myqaweb.feature;

import com.myqaweb.common.ConflictException;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

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
    private final VersionRepository versionRepository;
    private final AgentLiveFrameStore frameStore;
    private final AgentWorkerRegistry workerRegistry;
    private final AgentStepScreenshotRepository screenshotRepository;

    /** /queue 한 페이지 최대 행 수. */
    public static final int MAX_QUEUE_PAGE_SIZE = 100;

    /** 같은 Phase에서 TC 중복을 막을 대상 상태 (대기·실행 중). */
    private static final List<AgentExecutionStatus> ACTIVE_STATUSES =
            List.of(AgentExecutionStatus.PENDING, AgentExecutionStatus.RUNNING);

    @Override
    @Transactional
    public Long submitJob(AgentExecutionDto.CreateJobRequest request) {
        validateTarget(request);

        // 실행 대상 TC를 제출 시점에 고정한다 (이후 Phase 구성이 바뀌어도 이 Job은 영향받지 않음)
        List<Long> testCaseIds = switch (request.scope()) {
            case SINGLE -> List.of(request.targetTestCaseId());
            case PHASE_SELECTED -> request.testCaseIds().stream().distinct().toList();
            default -> resolvePhaseTestCaseIds(request.phaseId(), request.scope());
        };
        // 0건 Job은 워커가 바로 DONE 처리해 "실행했다"는 착각만 남긴다
        if (testCaseIds.isEmpty()) {
            throw new IllegalArgumentException("실행할 TC가 없습니다: " + request.scope());
        }
        rejectOverlap(request.phaseId(), testCaseIds);

        AgentExecutionJobEntity job = new AgentExecutionJobEntity();
        job.setProductId(request.productId());
        job.setScope(request.scope());
        job.setPhaseId(request.phaseId());
        job.setTargetTestCaseId(request.targetTestCaseId());
        job.setRequestedBy(request.requestedBy());
        job.setStatus(AgentExecutionStatus.PENDING);
        job.setTestCaseIds(testCaseIds.toArray(Long[]::new));
        job.setTotalCount(testCaseIds.size());

        Long id = jobRepository.save(job).getId();
        log.info("AgentExecution job created: id={}, scope={}, productId={}", id, request.scope(), request.productId());
        return id;
    }

    /**
     * 같은 Phase의 대기·실행 중 Job과 TC가 겹치면 409.
     * test_case_ids가 null인 Job(컬럼 도입 전)은 대상을 알 수 없으므로 겹치는 것으로 본다.
     */
    // ponytail: 조회 후 저장이라 동시 요청 2건은 함께 통과한다. 사용자가 늘면 phase_id 행 잠금으로 직렬화할 것.
    private void rejectOverlap(Long phaseId, List<Long> testCaseIds) {
        if (phaseId == null) {
            return;
        }
        Set<Long> requested = new HashSet<>(testCaseIds);
        for (AgentExecutionJobEntity active : jobRepository.findAllByPhaseIdAndStatusIn(phaseId, ACTIVE_STATUSES)) {
            Long[] existing = active.getTestCaseIds();
            if (existing == null || Arrays.stream(existing).anyMatch(requested::contains)) {
                throw new ConflictException(
                        "같은 Phase에서 대기·실행 중인 Job(#" + active.getId() + ")과 TC가 겹칩니다");
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public AgentExecutionDto.JobPageResponse listQueue(
            List<AgentExecutionStatus> statuses, int page, int size, Sort.Direction direction) {
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), MAX_QUEUE_PAGE_SIZE),
                Sort.by(direction, "createdAt", "id"));
        Page<AgentExecutionJobEntity> result = (statuses == null || statuses.isEmpty())
                ? jobRepository.findAll(pageable)
                : jobRepository.findAllByStatusIn(statuses, pageable);
        List<AgentExecutionJobEntity> jobs = result.getContent();

        // 이름은 건별 조회 없이 한 번에 읽는다 (페이지당 쿼리 수 고정)
        Map<Long, ProductEntity> products = byId(productRepository.findAllById(
                jobs.stream().map(AgentExecutionJobEntity::getProductId).collect(Collectors.toSet())),
                ProductEntity::getId);
        Map<Long, VersionPhaseEntity> phases = byId(versionPhaseRepository.findAllById(
                jobs.stream().map(AgentExecutionJobEntity::getPhaseId).filter(Objects::nonNull).collect(Collectors.toSet())),
                VersionPhaseEntity::getId);
        Map<Long, VersionEntity> versions = byId(versionRepository.findAllById(
                phases.values().stream().map(p -> p.getVersion().getId()).collect(Collectors.toSet())),
                VersionEntity::getId);
        Map<Long, TestCaseEntity> testCases = byId(testCaseRepository.findAllById(
                jobs.stream()
                        .filter(j -> j.getScope() == AgentExecutionScope.SINGLE)
                        .map(AgentExecutionJobEntity::getTargetTestCaseId)
                        .filter(Objects::nonNull).collect(Collectors.toSet())),
                TestCaseEntity::getId);

        List<AgentExecutionDto.JobListItem> items = jobs.stream().map(j -> {
            ProductEntity product = products.get(j.getProductId());
            VersionPhaseEntity phase = j.getPhaseId() == null ? null : phases.get(j.getPhaseId());
            VersionEntity version = phase == null ? null : versions.get(phase.getVersion().getId());
            TestCaseEntity tc = j.getScope() == AgentExecutionScope.SINGLE && j.getTargetTestCaseId() != null
                    ? testCases.get(j.getTargetTestCaseId()) : null;
            ExecTargetKind kind = product == null ? ExecTargetKind.WEB : product.getExecTargetKind();
            return new AgentExecutionDto.JobListItem(
                    AgentExecutionDto.JobResponse.from(j, kind),
                    product == null ? null : product.getName(),
                    product == null || product.getCompany() == null ? null : product.getCompany().getId(),
                    phase == null ? null : phase.getPhaseName(),
                    version == null ? null : version.getId(),
                    version == null ? null : version.getName(),
                    tc == null ? null : tc.getTitle());
        }).toList();

        return new AgentExecutionDto.JobPageResponse(
                items, result.getTotalElements(), result.getNumber(), result.getTotalPages());
    }

    private static <T> Map<Long, T> byId(Iterable<T> entities, Function<T, Long> idOf) {
        Map<Long, T> map = new HashMap<>();
        entities.forEach(e -> map.put(idOf.apply(e), e));
        return map;
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
        frameStore.clear(jobId);
        return AgentExecutionDto.JobResponse.from(jobRepository.save(job), execTargetKindOf(job.getProductId()));
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
    public AgentExecutionDto.JobResponse claimJob(Long jobId, String workerId) {
        AgentExecutionJobEntity job = findJob(jobId);
        switch (job.getStatus()) {
            case PENDING -> {
                job.setStatus(AgentExecutionStatus.RUNNING);
                job.setStartedAt(LocalDateTime.now());
                job.setWorkerId(workerId);
                jobRepository.save(job);
                log.info("AgentExecution job claimed: id={}, workerId={}", jobId, workerId);
            }
            case RUNNING -> { /* 이미 점유됨 — 현재 상태 그대로 반환 (idempotent) */ }
            default -> throw new IllegalArgumentException("점유할 수 없는 상태입니다: " + job.getStatus());
        }
        return AgentExecutionDto.JobResponse.from(job);
    }

    @Override
    public void heartbeat(AgentExecutionDto.WorkerHeartbeatRequest request) {
        workerRegistry.put(request);
    }

    @Override
    public List<AgentExecutionDto.WorkerStatus> listWorkers() {
        return workerRegistry.listActive();
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
        frameStore.clear(jobId);
        return AgentExecutionDto.JobResponse.from(jobRepository.save(job));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean storeFrame(Long jobId, byte[] data, String contentType) {
        if (findJob(jobId).getStatus() != AgentExecutionStatus.RUNNING) {
            return false;
        }
        frameStore.put(jobId, data, contentType);
        return true;
    }

    @Override
    public Optional<AgentLiveFrameStore.Frame> getFrame(Long jobId) {
        return frameStore.get(jobId);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean storeProgress(Long jobId, AgentExecutionDto.LiveProgress progress) {
        if (findJob(jobId).getStatus() != AgentExecutionStatus.RUNNING) {
            return false;
        }
        frameStore.putProgress(jobId, progress);
        return true;
    }

    @Override
    public Optional<AgentExecutionDto.LiveProgress> getProgress(Long jobId) {
        return frameStore.getProgress(jobId);
    }

    @Override
    @Transactional
    public void storeScreenshot(Long jobId, Long testCaseId, Integer stepOrder, byte[] data, String contentType) {
        Long[] jobTestCaseIds = findJob(jobId).getTestCaseIds();
        if (jobTestCaseIds != null && !Arrays.asList(jobTestCaseIds).contains(testCaseId)) {
            throw new IllegalArgumentException("이 Job의 TC가 아닙니다: testCaseId=" + testCaseId);
        }

        // 긴 변 1280px JPEG로 줄여 저장. 변환이 안 되면 원본을 그대로 둔다 (증적 누락보다 용량이 낫다)
        byte[] stored = data;
        String storedType = contentType;
        try {
            Optional<byte[]> jpeg = AgentScreenshotConverter.toJpeg(data);
            if (jpeg.isPresent()) {
                stored = jpeg.get();
                storedType = MediaType.IMAGE_JPEG_VALUE;
            } else {
                log.warn("Screenshot not decodable, storing original: jobId={}, testCaseId={}, step={}",
                        jobId, testCaseId, stepOrder);
            }
        } catch (IOException | RuntimeException | LinkageError e) {
            log.warn("Screenshot conversion failed, storing original: jobId={}, testCaseId={}, step={}: {}",
                    jobId, testCaseId, stepOrder, e.toString());
        }

        AgentStepScreenshotEntity shot = screenshotRepository
                .findByJobIdAndTestCaseIdAndStepOrder(jobId, testCaseId, stepOrder)
                .orElseGet(AgentStepScreenshotEntity::new);
        shot.setJobId(jobId);
        shot.setTestCaseId(testCaseId);
        shot.setStepOrder(stepOrder);
        shot.setContentType(storedType);
        shot.setData(stored);
        shot.setCreatedAt(LocalDateTime.now()); // 덮어쓰면 보존 기간도 새로 시작
        screenshotRepository.save(shot);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AgentStepScreenshotEntity> getScreenshot(Long jobId, Long testCaseId, Integer stepOrder) {
        findJob(jobId);
        return screenshotRepository.findByJobIdAndTestCaseIdAndStepOrder(jobId, testCaseId, stepOrder);
    }

    @Override
    @Transactional(readOnly = true)
    public AgentExecutionDto.WorkerContextResponse getExecutionContext(Long jobId) {
        AgentExecutionJobEntity job = findJob(jobId);
        ProductEntity product = productRepository.findById(job.getProductId())
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + job.getProductId()));

        List<AgentExecutionDto.TestCaseContext> testCases;
        if (job.getTestCaseIds() != null) {
            // 제출 시점에 고정된 TC 목록을 순서대로 (삭제된 TC는 건너뜀)
            testCases = Arrays.stream(job.getTestCaseIds())
                    .map(id -> testCaseRepository.findById(id).orElse(null))
                    .filter(Objects::nonNull)
                    .map(tc -> AgentExecutionDto.TestCaseContext.from(tc, resolveSegmentNames(tc)))
                    .toList();
        } else if (job.getScope() == AgentExecutionScope.SINGLE) {
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
        } else if (request.scope() == AgentExecutionScope.PHASE_SELECTED) {
            if (request.testCaseIds() == null || request.testCaseIds().isEmpty()) {
                throw new IllegalArgumentException("PHASE_SELECTED scope는 testCaseIds가 필요합니다");
            }
            Set<Long> members = new HashSet<>(resolvePhaseTestCaseIds(request.phaseId(), AgentExecutionScope.PHASE_ALL));
            if (!members.containsAll(request.testCaseIds())) {
                throw new IllegalArgumentException("testCaseIds에 해당 Phase에 속하지 않는 TC가 있습니다");
            }
        }
    }
}
