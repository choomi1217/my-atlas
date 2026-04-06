package com.myqaweb.feature;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TestResultController.class)
@Import(GlobalExceptionHandler.class)
class TestResultControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TestResultService testResultService;

    @Autowired
    private ObjectMapper objectMapper;

    private TestResultEntity createMockResult(Long id, RunResultStatus status, String comment, LocalDateTime executedAt) {
        TestResultEntity result = new TestResultEntity();
        result.setId(id);
        result.setStatus(status);
        result.setComment(comment);
        result.setExecutedAt(executedAt);
        result.setCreatedAt(LocalDateTime.now());
        result.setUpdatedAt(LocalDateTime.now());

        VersionEntity version = new VersionEntity();
        version.setId(1L);
        result.setVersion(version);

        VersionPhaseEntity phase = new VersionPhaseEntity();
        phase.setId(1L);
        result.setVersionPhase(phase);

        TestCaseEntity testCase = new TestCaseEntity();
        testCase.setId(id);
        testCase.setTitle("Test Case " + id);
        result.setTestCase(testCase);

        return result;
    }

    @BeforeEach
    void setUp() {
    }

    @Test
    void testGetVersionResults_OptionA_Success() throws Exception {
        // Given - Version 전체 결과 (Option A)
        TestResultEntity result1 = createMockResult(1L, RunResultStatus.PASS, null, null);
        TestResultEntity result2 = createMockResult(2L, RunResultStatus.FAIL, null, null);

        when(testResultService.getAllByVersionId(1L)).thenReturn(List.of(result1, result2));

        // When & Then
        mockMvc.perform(get("/api/versions/{versionId}/results", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].status", is("PASS")))
                .andExpect(jsonPath("$.data[1].status", is("FAIL")));

        verify(testResultService).getAllByVersionId(1L);
    }

    @Test
    void testGetPhaseResults_OptionB_Success() throws Exception {
        // Given - Phase별 결과 (Option B)
        TestResultEntity result1 = createMockResult(1L, RunResultStatus.PASS, null, null);
        TestResultEntity result2 = createMockResult(2L, RunResultStatus.FAIL, null, null);

        when(testResultService.getAllByVersionPhaseId(1L)).thenReturn(List.of(result1, result2));

        // When & Then
        mockMvc.perform(get("/api/versions/{versionId}/phases/{phaseId}/results", 1L, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].status", is("PASS")))
                .andExpect(jsonPath("$.data[1].status", is("FAIL")));

        verify(testResultService).getAllByVersionPhaseId(1L);
    }

    @Test
    void testUpdateResult_Success() throws Exception {
        // Given
        TestResultEntity testResult = createMockResult(1L, RunResultStatus.PASS, "All tests passed", LocalDateTime.now());

        when(testResultService.updateResult(eq(1L), eq(RunResultStatus.PASS), any()))
                .thenReturn(testResult);

        // When & Then
        mockMvc.perform(patch("/api/versions/{versionId}/results/{resultId}", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"PASS\",\"comment\":\"All tests passed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.status", is("PASS")))
                .andExpect(jsonPath("$.data.comment", is("All tests passed")));

        verify(testResultService).updateResult(eq(1L), eq(RunResultStatus.PASS), any());
    }

    @Test
    void testUpdateResult_StatusFail() throws Exception {
        // Given
        TestResultEntity testResult = createMockResult(1L, RunResultStatus.FAIL, "Failed due to timeout", LocalDateTime.now());

        when(testResultService.updateResult(eq(1L), eq(RunResultStatus.FAIL), any()))
                .thenReturn(testResult);

        // When & Then
        mockMvc.perform(patch("/api/versions/{versionId}/results/{resultId}", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"FAIL\",\"comment\":\"Failed due to timeout\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("FAIL")))
                .andExpect(jsonPath("$.data.comment", is("Failed due to timeout")));

        verify(testResultService).updateResult(eq(1L), eq(RunResultStatus.FAIL), any());
    }

    @Test
    void testUpdateResult_StatusBlocked() throws Exception {
        // Given
        TestResultEntity testResult = createMockResult(1L, RunResultStatus.BLOCKED, "Blocked by issue #123", LocalDateTime.now());

        when(testResultService.updateResult(eq(1L), eq(RunResultStatus.BLOCKED), any()))
                .thenReturn(testResult);

        // When & Then
        mockMvc.perform(patch("/api/versions/{versionId}/results/{resultId}", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"BLOCKED\",\"comment\":\"Blocked by issue #123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("BLOCKED")));

        verify(testResultService).updateResult(eq(1L), eq(RunResultStatus.BLOCKED), any());
    }

    @Test
    void testUpdateResult_StatusSkipped() throws Exception {
        // Given
        TestResultEntity testResult = createMockResult(1L, RunResultStatus.SKIPPED, "Skipped - not applicable to this environment", LocalDateTime.now());

        when(testResultService.updateResult(eq(1L), eq(RunResultStatus.SKIPPED), any()))
                .thenReturn(testResult);

        // When & Then
        mockMvc.perform(patch("/api/versions/{versionId}/results/{resultId}", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"SKIPPED\",\"comment\":\"Skipped - not applicable to this environment\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("SKIPPED")));

        verify(testResultService).updateResult(eq(1L), eq(RunResultStatus.SKIPPED), any());
    }

    @Test
    void testUpdateResult_StatusRetest() throws Exception {
        // Given
        TestResultEntity testResult = createMockResult(1L, RunResultStatus.RETEST, "Need retest after fix", LocalDateTime.now());

        when(testResultService.updateResult(eq(1L), eq(RunResultStatus.RETEST), any()))
                .thenReturn(testResult);

        // When & Then
        mockMvc.perform(patch("/api/versions/{versionId}/results/{resultId}", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"RETEST\",\"comment\":\"Need retest after fix\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("RETEST")));

        verify(testResultService).updateResult(eq(1L), eq(RunResultStatus.RETEST), any());
    }

    @Test
    void testUpdateResult_StatusUntested() throws Exception {
        // Given
        TestResultEntity testResult = createMockResult(1L, RunResultStatus.UNTESTED, "Reset to untested", null);

        when(testResultService.updateResult(eq(1L), eq(RunResultStatus.UNTESTED), any()))
                .thenReturn(testResult);

        // When & Then
        mockMvc.perform(patch("/api/versions/{versionId}/results/{resultId}", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"UNTESTED\",\"comment\":\"Reset to untested\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("UNTESTED")))
                .andExpect(jsonPath("$.data.executedAt", nullValue()));

        verify(testResultService).updateResult(eq(1L), eq(RunResultStatus.UNTESTED), any());
    }

    @Test
    void testUpdateResult_WithoutComment() throws Exception {
        // Given
        TestResultEntity testResult = createMockResult(1L, RunResultStatus.PASS, null, LocalDateTime.now());

        when(testResultService.updateResult(eq(1L), eq(RunResultStatus.PASS), any()))
                .thenReturn(testResult);

        // When & Then
        mockMvc.perform(patch("/api/versions/{versionId}/results/{resultId}", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"PASS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        verify(testResultService).updateResult(eq(1L), eq(RunResultStatus.PASS), any());
    }
}
