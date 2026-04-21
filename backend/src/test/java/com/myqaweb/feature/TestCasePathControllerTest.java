package com.myqaweb.feature;

import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller slice tests for {@link TestCasePathController}.
 * Validates wiring for the three user-triggered path flows:
 * PATCH /path, POST /apply-suggested-path, POST /bulk-apply-suggested-path.
 */
@WebMvcTest(TestCasePathController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class TestCasePathControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TestCaseService testCaseService;

    private final LocalDateTime now = LocalDateTime.of(2026, 4, 20, 10, 0, 0);

    // --- PATCH /api/test-cases/{id}/path ---

    @Test
    void patchPath_200_withBody() throws Exception {
        // Arrange
        TestCaseDto.TestCaseResponse updated = new TestCaseDto.TestCaseResponse(
                1L, 10L, new Long[]{12L, 34L}, new String[]{"결제", "NFC"},
                "Login test", "desc", null, null, List.of(),
                "ok", Priority.HIGH, TestType.FUNCTIONAL, TestStatus.ACTIVE,
                List.of(), now, now, null);
        when(testCaseService.updatePath(eq(1L), any(Long[].class))).thenReturn(updated);

        // Act & Assert
        mockMvc.perform(patch("/api/test-cases/1/path")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"path\":[12,34]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.path[0]").value(12))
                .andExpect(jsonPath("$.data.path[1]").value(34));

        verify(testCaseService).updatePath(eq(1L), any(Long[].class));
    }

    @Test
    void patchPath_400_whenServiceThrows() throws Exception {
        // Arrange
        when(testCaseService.updatePath(eq(1L), any(Long[].class)))
                .thenThrow(new IllegalArgumentException(
                        "Segment 99 does not belong to product 10"));

        // Act & Assert
        mockMvc.perform(patch("/api/test-cases/1/path")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"path\":[99]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        "Segment 99 does not belong to product 10"));
    }

    // --- POST /api/test-cases/{id}/apply-suggested-path ---

    @Test
    void applySuggestedPath_200_withResponse() throws Exception {
        // Arrange — full match, 1 newly created segment
        TestCaseDto.ApplySuggestedPathResponse resp = new TestCaseDto.ApplySuggestedPathResponse(
                1L, new Long[]{10L, 20L}, 2, true, 2, 1, null);
        when(testCaseService.applySuggestedPath(1L)).thenReturn(resp);

        // Act & Assert
        mockMvc.perform(post("/api/test-cases/1/apply-suggested-path"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.testCaseId").value(1))
                .andExpect(jsonPath("$.data.resolvedPath[0]").value(10))
                .andExpect(jsonPath("$.data.resolvedPath[1]").value(20))
                .andExpect(jsonPath("$.data.resolvedLength").value(2))
                .andExpect(jsonPath("$.data.fullMatch").value(true))
                .andExpect(jsonPath("$.data.suggestedLength").value(2))
                .andExpect(jsonPath("$.data.createdSegmentCount").value(1))
                .andExpect(jsonPath("$.data.error").doesNotExist());

        verify(testCaseService).applySuggestedPath(1L);
    }

    @Test
    void applySuggestedPath_200_whenNoSuggestion() throws Exception {
        // Arrange — no suggestion stored on the TC
        TestCaseDto.ApplySuggestedPathResponse resp = new TestCaseDto.ApplySuggestedPathResponse(
                1L, new Long[0], 0, false, 0, 0, "NO_SUGGESTION");
        when(testCaseService.applySuggestedPath(1L)).thenReturn(resp);

        // Act & Assert
        mockMvc.perform(post("/api/test-cases/1/apply-suggested-path"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.testCaseId").value(1))
                .andExpect(jsonPath("$.data.resolvedLength").value(0))
                .andExpect(jsonPath("$.data.fullMatch").value(false))
                .andExpect(jsonPath("$.data.suggestedLength").value(0))
                .andExpect(jsonPath("$.data.createdSegmentCount").value(0))
                .andExpect(jsonPath("$.data.error").value("NO_SUGGESTION"));
    }

    @Test
    void applySuggestedPath_400_whenServiceThrows() throws Exception {
        // Arrange
        when(testCaseService.applySuggestedPath(99L))
                .thenThrow(new IllegalArgumentException("Test case not found: 99"));

        // Act & Assert
        mockMvc.perform(post("/api/test-cases/99/apply-suggested-path"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Test case not found: 99"));
    }

    // --- POST /api/test-cases/bulk-apply-suggested-path ---

    @Test
    void bulkApplySuggestedPath_200_withMixedResults() throws Exception {
        // Arrange — one normal, one NOT_FOUND, one NO_SUGGESTION
        List<TestCaseDto.ApplySuggestedPathResponse> results = List.of(
                new TestCaseDto.ApplySuggestedPathResponse(
                        1L, new Long[]{10L, 20L}, 2, true, 2, 1, null),
                new TestCaseDto.ApplySuggestedPathResponse(
                        2L, new Long[0], 0, false, 0, 0, "NOT_FOUND"),
                new TestCaseDto.ApplySuggestedPathResponse(
                        3L, new Long[0], 0, false, 0, 0, "NO_SUGGESTION")
        );
        when(testCaseService.bulkApplySuggestedPath(any())).thenReturn(results);

        // Act & Assert
        mockMvc.perform(post("/api/test-cases/bulk-apply-suggested-path")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"testCaseIds\":[1,2,3]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(3))
                .andExpect(jsonPath("$.data[0].testCaseId").value(1))
                .andExpect(jsonPath("$.data[0].fullMatch").value(true))
                .andExpect(jsonPath("$.data[0].createdSegmentCount").value(1))
                .andExpect(jsonPath("$.data[0].error").doesNotExist())
                .andExpect(jsonPath("$.data[1].testCaseId").value(2))
                .andExpect(jsonPath("$.data[1].error").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data[2].testCaseId").value(3))
                .andExpect(jsonPath("$.data[2].error").value("NO_SUGGESTION"));

        verify(testCaseService).bulkApplySuggestedPath(any());
    }
}
