package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 에이전트 실행 Job REST 엔드포인트 (registry_v20 Phase 1 Step 2).
 * 모든 응답은 {@link ApiResponse}로 감싼다.
 *
 * <p>워커 통신은 폴링 모델: 외부 실행 워커가 {@code /claim} → {@code /results} → {@code /complete}
 * 순으로 Job을 처리한다.</p>
 */
@RestController
@RequestMapping("/api/agent-executions")
@RequiredArgsConstructor
public class AgentExecutionController {

    private final AgentExecutionService agentExecutionService;

    // --- 사용자(프론트) 대상 ---

    /** Job 생성 (PENDING). */
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Long>>> createJob(
            @Valid @RequestBody AgentExecutionDto.CreateJobRequest request) {
        Long jobId = agentExecutionService.submitJob(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Agent execution job created", Map.of("jobId", jobId)));
    }

    /** 단건 Job 상태 조회 (폴링). */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AgentExecutionDto.JobResponse>> getJob(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(agentExecutionService.getJob(id)));
    }

    /** Product 또는 Phase별 Job 목록 (최신순). 정확히 하나의 파라미터만 허용. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<AgentExecutionDto.JobResponse>>> listJobs(
            @RequestParam(value = "productId", required = false) Long productId,
            @RequestParam(value = "phaseId", required = false) Long phaseId) {
        if (productId == null && phaseId == null) {
            throw new IllegalArgumentException("productId 또는 phaseId가 필요합니다");
        }
        if (productId != null && phaseId != null) {
            throw new IllegalArgumentException("productId와 phaseId는 동시에 지정할 수 없습니다");
        }
        List<AgentExecutionDto.JobResponse> jobs = productId != null
                ? agentExecutionService.listByProduct(productId)
                : agentExecutionService.listByPhase(phaseId);
        return ResponseEntity.ok(ApiResponse.ok(jobs));
    }

    /** Job 취소. */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<AgentExecutionDto.JobResponse>> cancelJob(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Agent execution job cancelled", agentExecutionService.cancelJob(id)));
    }

    /** TC별 실행 증적 조회. */
    @GetMapping("/{id}/results/{testCaseId}")
    public ResponseEntity<ApiResponse<AgentExecutionDto.ResultResponse>> getResult(
            @PathVariable Long id, @PathVariable Long testCaseId) {
        return ResponseEntity.ok(ApiResponse.ok(agentExecutionService.getResult(id, testCaseId)));
    }

    /** Job의 전체 TC 결과(증적) 목록. */
    @GetMapping("/{id}/results")
    public ResponseEntity<ApiResponse<List<AgentExecutionDto.ResultResponse>>> listResults(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(agentExecutionService.listResults(id)));
    }

    // --- 워커 대상 (폴링 통신 경로) ---

    /** 워커가 Job 점유: PENDING → RUNNING. */
    @PostMapping("/{id}/claim")
    public ResponseEntity<ApiResponse<AgentExecutionDto.JobResponse>> claimJob(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(agentExecutionService.claimJob(id)));
    }

    /** 워커가 실행 컨텍스트(대상 TC + Product 실행 프로파일) 조회. */
    @GetMapping("/{id}/context")
    public ResponseEntity<ApiResponse<AgentExecutionDto.WorkerContextResponse>> getContext(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(agentExecutionService.getExecutionContext(id)));
    }

    /** 워커가 TC 1건 실행 결과 보고. */
    @PostMapping("/{id}/results")
    public ResponseEntity<ApiResponse<AgentExecutionDto.ResultResponse>> recordResult(
            @PathVariable Long id, @Valid @RequestBody AgentExecutionDto.RecordResultRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Result recorded", agentExecutionService.recordResult(id, request)));
    }

    /** 워커가 Job 종료 보고 (DONE/FAILED). */
    @PostMapping("/{id}/complete")
    public ResponseEntity<ApiResponse<AgentExecutionDto.JobResponse>> completeJob(
            @PathVariable Long id, @Valid @RequestBody AgentExecutionDto.CompleteJobRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Agent execution job completed", agentExecutionService.completeJob(id, request)));
    }
}
