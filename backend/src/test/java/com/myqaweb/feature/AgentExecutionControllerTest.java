package com.myqaweb.feature;

import com.myqaweb.common.GlobalExceptionHandler;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

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
 * Controller tests for AgentExecutionController — live view frame endpoints (registry_v26).
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
}
