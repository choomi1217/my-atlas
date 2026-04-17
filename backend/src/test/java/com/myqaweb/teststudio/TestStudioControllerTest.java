package com.myqaweb.teststudio;

import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller slice tests for {@link TestStudioController}.
 * Mirrors pattern from {@code TestCaseControllerTest} —
 * imports {@link GlobalExceptionHandler} and disables security filters.
 */
@WebMvcTest(TestStudioController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class TestStudioControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TestStudioService testStudioService;

    private final LocalDateTime now = LocalDateTime.of(2026, 4, 17, 10, 0, 0);

    // --- POST /api/test-studio/jobs ---

    @Test
    void createJob_markdown_returns201WithJobId() throws Exception {
        // Arrange
        when(testStudioService.submitJob(eq(10L), eq(SourceType.MARKDOWN),
                eq("Spec v1"), eq("# Heading"), any()))
                .thenReturn(42L);

        // Act & Assert
        mockMvc.perform(multipart("/api/test-studio/jobs")
                        .param("productId", "10")
                        .param("sourceType", "MARKDOWN")
                        .param("title", "Spec v1")
                        .param("content", "# Heading"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.jobId").value(42));

        verify(testStudioService).submitJob(eq(10L), eq(SourceType.MARKDOWN),
                eq("Spec v1"), eq("# Heading"), any());
    }

    @Test
    void createJob_pdf_returns201WithJobId() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "spec.pdf", "application/pdf", "%PDF-fake".getBytes());
        when(testStudioService.submitJob(eq(10L), eq(SourceType.PDF),
                eq("PDF Title"), any(), any()))
                .thenReturn(77L);

        // Act & Assert
        mockMvc.perform(multipart("/api/test-studio/jobs")
                        .file(file)
                        .param("productId", "10")
                        .param("sourceType", "PDF")
                        .param("title", "PDF Title"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.jobId").value(77));

        verify(testStudioService).submitJob(eq(10L), eq(SourceType.PDF),
                eq("PDF Title"), any(), any());
    }

    @Test
    void createJob_returns400WhenServiceThrowsIllegalArgument() throws Exception {
        // Arrange
        when(testStudioService.submitJob(any(), any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Product not found: 99"));

        // Act & Assert
        mockMvc.perform(multipart("/api/test-studio/jobs")
                        .param("productId", "99")
                        .param("sourceType", "MARKDOWN")
                        .param("title", "T")
                        .param("content", "body"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Product not found: 99"));
    }

    // --- GET /api/test-studio/jobs ---

    @Test
    void listJobs_returnsOk() throws Exception {
        // Arrange
        List<TestStudioJobDto.JobResponse> jobs = List.of(
                new TestStudioJobDto.JobResponse(1L, 10L, SourceType.MARKDOWN,
                        "Title 1", TestStudioJobStatus.DONE, null, 3, now, now),
                new TestStudioJobDto.JobResponse(2L, 10L, SourceType.PDF,
                        "Title 2", TestStudioJobStatus.PENDING, null, 0, now, null)
        );
        when(testStudioService.listJobs(10L)).thenReturn(jobs);

        // Act & Assert
        mockMvc.perform(get("/api/test-studio/jobs").param("productId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].sourceTitle").value("Title 1"));

        verify(testStudioService).listJobs(10L);
    }

    // --- GET /api/test-studio/jobs/{id} ---

    @Test
    void getJob_returnsOk() throws Exception {
        // Arrange
        TestStudioJobDto.JobResponse resp = new TestStudioJobDto.JobResponse(
                42L, 10L, SourceType.MARKDOWN, "Title",
                TestStudioJobStatus.DONE, null, 5, now, now);
        when(testStudioService.getJob(42L)).thenReturn(resp);

        // Act & Assert
        mockMvc.perform(get("/api/test-studio/jobs/42"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(42))
                .andExpect(jsonPath("$.data.sourceTitle").value("Title"))
                .andExpect(jsonPath("$.data.status").value("DONE"));

        verify(testStudioService).getJob(42L);
    }

    @Test
    void getJob_returns400WhenNotFound() throws Exception {
        when(testStudioService.getJob(99L))
                .thenThrow(new IllegalArgumentException("Job not found: 99"));

        mockMvc.perform(get("/api/test-studio/jobs/99"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- DELETE /api/test-studio/jobs/{id} ---

    @Test
    void deleteJob_returns204() throws Exception {
        // Arrange
        doNothing().when(testStudioService).deleteJob(42L);

        // Act & Assert
        mockMvc.perform(delete("/api/test-studio/jobs/42"))
                .andExpect(status().isNoContent());

        verify(testStudioService).deleteJob(42L);
    }

    @Test
    void deleteJob_returns400WhenNotFound() throws Exception {
        doThrow(new IllegalArgumentException("Job not found: 99"))
                .when(testStudioService).deleteJob(99L);

        mockMvc.perform(delete("/api/test-studio/jobs/99"))
                .andExpect(status().isBadRequest());
    }
}
