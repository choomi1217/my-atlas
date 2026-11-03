package com.myqaweb.feature;

import com.myqaweb.common.ConflictException;
import com.myqaweb.common.GlobalExceptionHandler;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for AgentExecutionController — live view (registry_v26, v27),
 * queue, workers, claim and step screenshots (registry_v31).
 */
@WebMvcTest(AgentExecutionController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class AgentExecutionControllerTest {

    private static final byte[] PNG_BYTES = {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AgentExecutionService agentExecutionService;

    // --- PUT /api/agent-executions/{id}/frame ---

    @Test
    void putFrame_png_running_returnsNoContent() throws Exception {
        when(agentExecutionService.storeFrame(eq(1L), any(byte[].class), anyString())).thenReturn(true);

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 1L)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(PNG_BYTES))
                .andExpect(status().isNoContent());

        verify(agentExecutionService).storeFrame(1L, PNG_BYTES, MediaType.IMAGE_PNG_VALUE);
    }

    @Test
    void putFrame_jpeg_running_returnsNoContent() throws Exception {
        when(agentExecutionService.storeFrame(eq(1L), any(byte[].class), anyString())).thenReturn(true);

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 1L)
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(new byte[] {(byte) 0xFF, (byte) 0xD8}))
                .andExpect(status().isNoContent());

        verify(agentExecutionService).storeFrame(eq(1L), any(byte[].class), eq(MediaType.IMAGE_JPEG_VALUE));
    }

    @Test
    void putFrame_notRunning_returnsConflict() throws Exception {
        when(agentExecutionService.storeFrame(eq(1L), any(byte[].class), anyString())).thenReturn(false);

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 1L)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(PNG_BYTES))
                .andExpect(status().isConflict());
    }

    @Test
    void putFrame_overMaxSize_returnsContentTooLarge() throws Exception {
        byte[] tooLarge = new byte[AgentExecutionController.MAX_FRAME_BYTES + 1];

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 1L)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(tooLarge))
                .andExpect(status().is(413));

        verify(agentExecutionService, never()).storeFrame(anyLong(), any(), any());
    }

    @Test
    void putFrame_unknownJob_returnsNotFound() throws Exception {
        when(agentExecutionService.storeFrame(eq(999L), any(byte[].class), anyString()))
                .thenThrow(new EntityNotFoundException("AgentExecution job not found: 999"));

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 999L)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(PNG_BYTES))
                .andExpect(status().isNotFound());
    }

    // --- GET /api/agent-executions/{id}/frame ---

    @Test
    void getFrame_exists_returnsBytesWithContentTypeAndNoStore() throws Exception {
        when(agentExecutionService.getFrame(1L))
                .thenReturn(Optional.of(new AgentLiveFrameStore.Frame(PNG_BYTES, MediaType.IMAGE_PNG_VALUE)));

        mockMvc.perform(get("/api/agent-executions/{id}/frame", 1L))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(PNG_BYTES))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void getFrame_none_returnsNoContent() throws Exception {
        when(agentExecutionService.getFrame(1L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/agent-executions/{id}/frame", 1L))
                .andExpect(status().isNoContent())
                .andExpect(content().bytes(new byte[0]));
    }

    // --- PUT /api/agent-executions/{id}/progress (registry_v27) ---

    private static String stepJson(int order, String status) {
        return """
                {"order":%d,"action":"동작 %d","expected":"기대 %d","status":"%s","judgment":null}"""
                .formatted(order, order, order, status);
    }

    private static String progressJson(String title, String stepsJson) {
        return """
                {"testCaseId":10,"testCaseTitle":"%s","tcIndex":1,"tcTotal":1,"phase":"JUDGING",
                 "precondition":{"text":"로그인 화면","status":"DONE"},
                 "currentStep":2,"steps":[%s]}"""
                .formatted(title, stepsJson);
    }

    private static final String VALID_PROGRESS =
            progressJson("로그인 성공", stepJson(1, "PASS") + "," + stepJson(2, "JUDGING"));

    @Test
    void putProgress_valid_returnsNoContentAndPassesParsedRecord() throws Exception {
        when(agentExecutionService.storeProgress(eq(1L), any())).thenReturn(true);

        mockMvc.perform(put("/api/agent-executions/{id}/progress", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_PROGRESS))
                .andExpect(status().isNoContent());

        ArgumentCaptor<AgentExecutionDto.LiveProgress> captor =
                ArgumentCaptor.forClass(AgentExecutionDto.LiveProgress.class);
        verify(agentExecutionService).storeProgress(eq(1L), captor.capture());
        AgentExecutionDto.LiveProgress p = captor.getValue();
        assertThat(p.testCaseTitle()).isEqualTo("로그인 성공");
        assertThat(p.currentStep()).isEqualTo(2);
        assertThat(p.precondition().status()).isEqualTo("DONE");
        assertThat(p.steps()).hasSize(2);
        assertThat(p.steps().get(1).status()).isEqualTo("JUDGING");
    }

    @Test
    void putProgress_notRunning_returnsConflict() throws Exception {
        when(agentExecutionService.storeProgress(eq(1L), any())).thenReturn(false);

        mockMvc.perform(put("/api/agent-executions/{id}/progress", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_PROGRESS))
                .andExpect(status().isConflict());
    }

    @Test
    void putProgress_titleTooLong_returnsBadRequest() throws Exception {
        mockMvc.perform(put("/api/agent-executions/{id}/progress", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(progressJson("a".repeat(501), stepJson(1, "PASS"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(agentExecutionService, never()).storeProgress(anyLong(), any());
    }

    @Test
    void putProgress_tooManySteps_returnsBadRequest() throws Exception {
        String steps = IntStream.rangeClosed(1, 201)
                .mapToObj(i -> stepJson(i, "PENDING"))
                .collect(Collectors.joining(","));

        mockMvc.perform(put("/api/agent-executions/{id}/progress", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(progressJson("t", steps)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(agentExecutionService, never()).storeProgress(anyLong(), any());
    }

    @Test
    void putProgress_stepActionTooLong_returnsBadRequest() throws Exception {
        String step = """
                {"order":1,"action":"%s","expected":"e","status":"PENDING"}""".formatted("a".repeat(5001));

        mockMvc.perform(put("/api/agent-executions/{id}/progress", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(progressJson("t", step)))
                .andExpect(status().isBadRequest());

        verify(agentExecutionService, never()).storeProgress(anyLong(), any());
    }

    @Test
    void putProgress_unknownJob_returnsNotFound() throws Exception {
        when(agentExecutionService.storeProgress(eq(999L), any()))
                .thenThrow(new EntityNotFoundException("AgentExecution job not found: 999"));

        mockMvc.perform(put("/api/agent-executions/{id}/progress", 999L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_PROGRESS))
                .andExpect(status().isNotFound());
    }

    // --- GET /api/agent-executions/{id}/progress ---

    @Test
    void getProgress_exists_returnsDataWithNoStore() throws Exception {
        var progress = new AgentExecutionDto.LiveProgress(
                10L, "로그인 성공", 1, 1, "JUDGING",
                new AgentExecutionDto.LivePrecondition("로그인 화면", "DONE"),
                2,
                List.of(new AgentExecutionDto.LiveStep(1, "클릭", "이동", "PASS", "이동 확인"),
                        new AgentExecutionDto.LiveStep(2, "입력", "표시", "JUDGING", null)));
        when(agentExecutionService.getProgress(1L)).thenReturn(Optional.of(progress));

        mockMvc.perform(get("/api/agent-executions/{id}/progress", 1L))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.currentStep").value(2))
                .andExpect(jsonPath("$.data.testCaseTitle").value("로그인 성공"))
                .andExpect(jsonPath("$.data.precondition.status").value("DONE"))
                .andExpect(jsonPath("$.data.steps[0].status").value("PASS"))
                .andExpect(jsonPath("$.data.steps[1].status").value("JUDGING"));
    }

    @Test
    void getProgress_none_returnsNullData() throws Exception {
        when(agentExecutionService.getProgress(1L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/agent-executions/{id}/progress", 1L))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    // --- POST /api/agent-executions (registry_v31) ---

    @Test
    void createJob_phaseSelected_passesTestCaseIds() throws Exception {
        when(agentExecutionService.submitJob(any())).thenReturn(5L);

        mockMvc.perform(post("/api/agent-executions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"scope":"PHASE_SELECTED","productId":10,"phaseId":99,"testCaseIds":[1,2]}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.jobId").value(5));

        verify(agentExecutionService).submitJob(new AgentExecutionDto.CreateJobRequest(
                AgentExecutionScope.PHASE_SELECTED, 10L, 99L, null, null, List.of(1L, 2L)));
    }

    @Test
    void createJob_conflict_returns409WithMessage() throws Exception {
        when(agentExecutionService.submitJob(any())).thenThrow(new ConflictException("TC가 겹칩니다"));

        mockMvc.perform(post("/api/agent-executions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"scope":"PHASE_ALL","productId":10,"phaseId":99}"""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("TC가 겹칩니다"));
    }

    // --- GET /api/agent-executions/queue ---

    private static AgentExecutionDto.JobResponse jobResponse(AgentExecutionStatus status, String workerId) {
        return new AgentExecutionDto.JobResponse(
                1L, 10L, 99L, null, AgentExecutionScope.PHASE_ALL, status, ExecTargetKind.WEB, null,
                2, 0, 0, 0, 0, null, LocalDateTime.of(2026, 11, 1, 9, 0), null,
                LocalDateTime.of(2026, 11, 1, 9, 1), workerId);
    }

    @Test
    void listQueue_bindsRepeatedStatusAndParams() throws Exception {
        var item = new AgentExecutionDto.JobListItem(
                jobResponse(AgentExecutionStatus.RUNNING, "host:web"), "패스오더", 1L, "1차", 5L, "v1.0", null);
        when(agentExecutionService.listQueue(
                List.of(AgentExecutionStatus.PENDING, AgentExecutionStatus.RUNNING), 2, 50, Sort.Direction.ASC))
                .thenReturn(new AgentExecutionDto.JobPageResponse(List.of(item), 101, 2, 3));

        mockMvc.perform(get("/api/agent-executions/queue")
                        .param("status", "PENDING")
                        .param("status", "RUNNING")
                        .param("page", "2")
                        .param("size", "50")
                        .param("direction", "ASC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].job.id").value(1))
                .andExpect(jsonPath("$.data.items[0].job.workerId").value("host:web"))
                .andExpect(jsonPath("$.data.items[0].productName").value("패스오더"))
                .andExpect(jsonPath("$.data.items[0].companyId").value(1))
                .andExpect(jsonPath("$.data.items[0].versionId").value(5))
                .andExpect(jsonPath("$.data.totalElements").value(101))
                .andExpect(jsonPath("$.data.page").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(3));
    }

    @Test
    void listQueue_noParams_usesDefaults() throws Exception {
        when(agentExecutionService.listQueue(any(), anyInt(), anyInt(), any()))
                .thenReturn(new AgentExecutionDto.JobPageResponse(List.of(), 0, 0, 0));

        mockMvc.perform(get("/api/agent-executions/queue"))
                .andExpect(status().isOk());

        verify(agentExecutionService).listQueue(null, 0, 30, Sort.Direction.DESC);
    }

    @Test
    void listQueue_invalidDirection_returnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/agent-executions/queue").param("direction", "SIDEWAYS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(agentExecutionService, never()).listQueue(any(), anyInt(), anyInt(), any());
    }

    // --- /api/agent-executions/workers ---

    @Test
    void putWorker_valid_returnsNoContentAndPassesParsedRecord() throws Exception {
        mockMvc.perform(put("/api/agent-executions/workers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workerId":"host:web","targetKind":"WEB","productId":10,"deviceName":null,"currentJobId":3}"""))
                .andExpect(status().isNoContent());

        verify(agentExecutionService).heartbeat(new AgentExecutionDto.WorkerHeartbeatRequest(
                "host:web", ExecTargetKind.WEB, 10L, null, 3L));
    }

    @Test
    void putWorker_blankWorkerId_returnsBadRequest() throws Exception {
        mockMvc.perform(put("/api/agent-executions/workers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workerId":" ","targetKind":"WEB"}"""))
                .andExpect(status().isBadRequest());

        verify(agentExecutionService, never()).heartbeat(any());
    }

    @Test
    void listWorkers_returnsActiveWorkersWithNoStore() throws Exception {
        when(agentExecutionService.listWorkers()).thenReturn(List.of(new AgentExecutionDto.WorkerStatus(
                "host:web", ExecTargetKind.WEB, null, null, 3L, LocalDateTime.of(2026, 11, 1, 9, 0))));

        mockMvc.perform(get("/api/agent-executions/workers"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data[0].workerId").value("host:web"))
                .andExpect(jsonPath("$.data[0].targetKind").value("WEB"))
                .andExpect(jsonPath("$.data[0].productId").value(nullValue()))
                .andExpect(jsonPath("$.data[0].currentJobId").value(3));
    }

    // --- /api/agent-executions/{id}/screenshots ---

    @Test
    void putScreenshot_valid_returnsNoContent() throws Exception {
        mockMvc.perform(put("/api/agent-executions/{id}/screenshots", 1L)
                        .param("testCaseId", "7")
                        .param("stepOrder", "2")
                        .contentType(MediaType.IMAGE_PNG)
                        .content(PNG_BYTES))
                .andExpect(status().isNoContent());

        verify(agentExecutionService).storeScreenshot(1L, 7L, 2, PNG_BYTES, MediaType.IMAGE_PNG_VALUE);
    }

    @Test
    void putScreenshot_overMaxSize_returnsContentTooLarge() throws Exception {
        mockMvc.perform(put("/api/agent-executions/{id}/screenshots", 1L)
                        .param("testCaseId", "7")
                        .param("stepOrder", "2")
                        .contentType(MediaType.IMAGE_PNG)
                        .content(new byte[AgentExecutionController.MAX_FRAME_BYTES + 1]))
                .andExpect(status().is(413));

        verify(agentExecutionService, never()).storeScreenshot(any(), any(), any(), any(), any());
    }

    @Test
    void putScreenshot_missingParameter_returnsBadRequest() throws Exception {
        mockMvc.perform(put("/api/agent-executions/{id}/screenshots", 1L)
                        .param("testCaseId", "2")
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(new byte[]{1}))
                .andExpect(status().isBadRequest());
    }

    @Test
    void putScreenshot_unsupportedContentType_returnsUnsupportedMediaType() throws Exception {
        mockMvc.perform(put("/api/agent-executions/{id}/screenshots", 1L)
                        .param("testCaseId", "2")
                        .param("stepOrder", "1")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("x"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void putScreenshot_unknownJob_returnsNotFound() throws Exception {
        doThrow(new EntityNotFoundException("AgentExecution job not found: 999"))
                .when(agentExecutionService).storeScreenshot(eq(999L), any(), any(), any(), any());

        mockMvc.perform(put("/api/agent-executions/{id}/screenshots", 999L)
                        .param("testCaseId", "7")
                        .param("stepOrder", "2")
                        .contentType(MediaType.IMAGE_PNG)
                        .content(PNG_BYTES))
                .andExpect(status().isNotFound());
    }

    @Test
    void getScreenshot_exists_returnsBytesWithContentTypeAndNoStore() throws Exception {
        var shot = new AgentStepScreenshotEntity();
        shot.setContentType(MediaType.IMAGE_JPEG_VALUE);
        shot.setData(PNG_BYTES);
        when(agentExecutionService.getScreenshot(1L, 7L, 2)).thenReturn(Optional.of(shot));

        mockMvc.perform(get("/api/agent-executions/{id}/screenshots", 1L)
                        .param("testCaseId", "7")
                        .param("stepOrder", "2"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andExpect(content().bytes(PNG_BYTES))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void getScreenshot_none_returnsNoContent() throws Exception {
        when(agentExecutionService.getScreenshot(1L, 7L, 2)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/agent-executions/{id}/screenshots", 1L)
                        .param("testCaseId", "7")
                        .param("stepOrder", "2"))
                .andExpect(status().isNoContent())
                .andExpect(content().bytes(new byte[0]));
    }

    // --- POST /api/agent-executions/{id}/claim ---

    @Test
    void claimJob_withBody_passesWorkerId() throws Exception {
        when(agentExecutionService.claimJob(1L, "host:web"))
                .thenReturn(jobResponse(AgentExecutionStatus.RUNNING, "host:web"));

        mockMvc.perform(post("/api/agent-executions/{id}/claim", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workerId":"host:web"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.workerId").value("host:web"))
                .andExpect(jsonPath("$.data.startedAt").exists());
    }

    @Test
    void claimJob_withoutBody_passesNullWorkerId() throws Exception {
        when(agentExecutionService.claimJob(1L, null))
                .thenReturn(jobResponse(AgentExecutionStatus.RUNNING, null));

        mockMvc.perform(post("/api/agent-executions/{id}/claim", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"));

        verify(agentExecutionService).claimJob(1L, null);
    }

    @Test
    void claimJob_workerIdTooLong_returnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/agent-executions/{id}/claim", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"workerId":"%s"}""".formatted("a".repeat(101))))
                .andExpect(status().isBadRequest());

        verify(agentExecutionService, never()).claimJob(anyLong(), any());
    }
}
