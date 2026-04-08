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
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TestRunController.class)
@Import(GlobalExceptionHandler.class)
class TestRunControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TestRunService testRunService;

    @Autowired
    private ObjectMapper objectMapper;

    private TestRunDto.TestRunDetail testRunDetail;
    private TestRunDto.TestRunSummary testRunSummary;

    @BeforeEach
    void setUp() {
        testRunDetail = new TestRunDto.TestRunDetail(
                1L, 1L, "Regression", "Regression Test Suite",
                List.of(
                        new TestRunDto.TestCaseSummary(1L, "Login Test"),
                        new TestRunDto.TestCaseSummary(2L, "Logout Test")
                ),
                LocalDateTime.now(), LocalDateTime.now()
        );

        testRunSummary = new TestRunDto.TestRunSummary(
                1L, 1L, "Regression", "Regression Test Suite",
                2, LocalDateTime.now(), LocalDateTime.now()
        );
    }

    @Test
    void testGetAllByProductId_Success() throws Exception {
        // Given
        when(testRunService.getAllByProductId(1L))
                .thenReturn(List.of(testRunSummary));

        // When & Then
        mockMvc.perform(get("/api/products/{productId}/test-runs", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].name", is("Regression")))
                .andExpect(jsonPath("$.data[0].testCaseCount", is(2)));

        verify(testRunService).getAllByProductId(1L);
    }

    @Test
    void testGetById_Success() throws Exception {
        // Given
        when(testRunService.getById(1L)).thenReturn(testRunDetail);

        // When & Then
        mockMvc.perform(get("/api/test-runs/{id}", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.id", is(1)))
                .andExpect(jsonPath("$.data.name", is("Regression")))
                .andExpect(jsonPath("$.data.testCases", hasSize(2)));

        verify(testRunService).getById(1L);
    }

    @Test
    void testCreateTestRun_Success() throws Exception {
        // Given
        TestRunDto.CreateTestRunRequest request = new TestRunDto.CreateTestRunRequest(
                1L, "Regression", "Regression Test Suite", List.of(1L, 2L)
        );

        when(testRunService.create(any())).thenReturn(testRunDetail);

        // When & Then
        mockMvc.perform(post("/api/products/{productId}/test-runs", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.name", is("Regression")))
                .andExpect(jsonPath("$.data.testCases", hasSize(2)));

        verify(testRunService).create(any());
    }

    @Test
    void testCreateTestRun_ValidationFails_MissingName() throws Exception {
        // Given
        TestRunDto.CreateTestRunRequest request = new TestRunDto.CreateTestRunRequest(
                1L, "", "Description", List.of(1L)
        );

        // When & Then
        mockMvc.perform(post("/api/products/{productId}/test-runs", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(testRunService, never()).create(any());
    }

    @Test
    void testCreateTestRun_ValidationFails_EmptyTestCases() throws Exception {
        // Given
        TestRunDto.CreateTestRunRequest request = new TestRunDto.CreateTestRunRequest(
                1L, "Regression", "Description", List.of()
        );

        // When & Then
        mockMvc.perform(post("/api/products/{productId}/test-runs", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(testRunService, never()).create(any());
    }

    @Test
    void testUpdateTestRun_Success() throws Exception {
        // Given
        TestRunDto.UpdateTestRunRequest request = new TestRunDto.UpdateTestRunRequest(
                "Updated Regression", "Updated Description", null
        );

        TestRunDto.TestRunDetail updated = new TestRunDto.TestRunDetail(
                1L, 1L, "Updated Regression", "Updated Description",
                List.of(), LocalDateTime.now(), LocalDateTime.now()
        );

        when(testRunService.update(eq(1L), any())).thenReturn(updated);

        // When & Then
        mockMvc.perform(patch("/api/test-runs/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.name", is("Updated Regression")));

        verify(testRunService).update(eq(1L), any());
    }

    @Test
    void testDeleteTestRun_Success() throws Exception {
        // Given
        doNothing().when(testRunService).delete(1L);

        // When & Then
        mockMvc.perform(delete("/api/test-runs/{id}", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        verify(testRunService).delete(1L);
    }
}
