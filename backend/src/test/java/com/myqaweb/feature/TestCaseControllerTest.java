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
 * Controller tests for TestCaseController.
 */
@WebMvcTest(TestCaseController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class TestCaseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TestCaseService testCaseService;

    @MockBean
    private TestCaseImageRepository testCaseImageRepository;

    @MockBean
    private TestCaseRepository testCaseRepository;

    private final LocalDateTime now = LocalDateTime.of(2026, 3, 26, 10, 0, 0);

    // --- GET /api/test-cases?productId={id} ---

    @Test
    void listByProduct_returnsOk() throws Exception {
        // Arrange
        List<TestCaseDto.TestCaseResponse> testCases = List.of(
                new TestCaseDto.TestCaseResponse(1L, 10L, new Long[]{1L, 2L}, null, "Login test",
                        "Verify login", null, "User exists", List.of(new TestStep(1, "Click login", "Form shown")),
                        "Login success", Priority.HIGH, TestType.FUNCTIONAL, TestStatus.ACTIVE, List.of(), now, now, null)
        );
        when(testCaseService.getByProductId(10L)).thenReturn(testCases);

        // Act & Assert
        mockMvc.perform(get("/api/test-cases").param("productId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].title").value("Login test"));

        verify(testCaseService).getByProductId(10L);
    }

    @Test
    void list_withProductId_delegates() throws Exception {
        // Arrange
        when(testCaseService.getByProductId(10L)).thenReturn(List.of());

        // Act & Assert
        mockMvc.perform(get("/api/test-cases").param("productId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(testCaseService).getByProductId(10L);
        verify(testCaseService, never()).getByCompanyId(any(), any());
    }

    @Test
    void list_withCompanyId_delegates() throws Exception {
        // Arrange
        when(testCaseService.getByCompanyId(5L, TestStatus.DRAFT)).thenReturn(List.of());

        // Act & Assert
        mockMvc.perform(get("/api/test-cases")
                        .param("companyId", "5")
                        .param("status", "DRAFT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(testCaseService).getByCompanyId(5L, TestStatus.DRAFT);
        verify(testCaseService, never()).getByProductId(any());
    }

    @Test
    void list_missingBoth_throws400() throws Exception {
        // Act & Assert
        mockMvc.perform(get("/api/test-cases"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(testCaseService, never()).getByProductId(any());
        verify(testCaseService, never()).getByCompanyId(any(), any());
    }

    @Test
    void list_bothProvided_throws400() throws Exception {
        // Act & Assert
        mockMvc.perform(get("/api/test-cases")
                        .param("productId", "10")
                        .param("companyId", "5"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(testCaseService, never()).getByProductId(any());
        verify(testCaseService, never()).getByCompanyId(any(), any());
    }

    // --- POST /api/test-cases ---

    @Test
    void create_returns201() throws Exception {
        // Arrange
        TestCaseDto.TestCaseResponse created = new TestCaseDto.TestCaseResponse(
                1L, 10L, new Long[]{1L}, null, "New TC", "Desc", null, null,
                List.of(), "Expected", Priority.MEDIUM, TestType.SMOKE, TestStatus.DRAFT, List.of(), now, now, null);
        when(testCaseService.create(any(TestCaseDto.TestCaseRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/test-cases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productId": 10,
                                  "path": [1],
                                  "title": "New TC",
                                  "description": "Desc",
                                  "steps": [],
                                  "expectedResult": "Expected",
                                  "priority": "MEDIUM",
                                  "testType": "SMOKE",
                                  "status": "DRAFT"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("New TC"));

        verify(testCaseService).create(any(TestCaseDto.TestCaseRequest.class));
    }

    @Test
    void create_returns400WhenTitleBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/test-cases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"productId": 10, "title": "", "priority": "HIGH", "testType": "FUNCTIONAL", "status": "DRAFT"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(testCaseService, never()).create(any());
    }

    // --- PUT /api/test-cases/{id} ---

    @Test
    void update_returnsOk() throws Exception {
        // Arrange
        TestCaseDto.TestCaseResponse updated = new TestCaseDto.TestCaseResponse(
                1L, 10L, new Long[]{1L}, null, "Updated TC", "Updated", null, null,
                List.of(), "Updated Expected", Priority.HIGH, TestType.REGRESSION, TestStatus.ACTIVE, List.of(), now, now, null);
        when(testCaseService.update(eq(1L), any(TestCaseDto.TestCaseRequest.class))).thenReturn(updated);

        // Act & Assert
        mockMvc.perform(put("/api/test-cases/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "productId": 10,
                                  "title": "Updated TC",
                                  "description": "Updated",
                                  "priority": "HIGH",
                                  "testType": "REGRESSION",
                                  "status": "ACTIVE"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Updated TC"));

        verify(testCaseService).update(eq(1L), any(TestCaseDto.TestCaseRequest.class));
    }

    // --- DELETE /api/test-cases/{id} ---

    @Test
    void delete_returnsOk() throws Exception {
        // Arrange
        doNothing().when(testCaseService).delete(1L);

        // Act & Assert
        mockMvc.perform(delete("/api/test-cases/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(testCaseService).delete(1L);
    }

    // --- POST /api/test-cases/generate-draft ---

    @Test
    void generateDraft_returnsCreated() throws Exception {
        // Arrange
        List<TestCaseDto.TestCaseResponse> drafts = List.of(
                new TestCaseDto.TestCaseResponse(1L, 10L, new Long[]{1L}, null, "AI Draft 1",
                        "AI generated", null, null, List.of(), "Pass",
                        Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT, List.of(), now, now, null)
        );
        when(testCaseService.generateDraft(any(TestCaseDto.GenerateDraftRequest.class))).thenReturn(drafts);

        // Act & Assert
        mockMvc.perform(post("/api/test-cases/generate-draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"productId": 10, "path": [1]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].title").value("AI Draft 1"));

        verify(testCaseService).generateDraft(any(TestCaseDto.GenerateDraftRequest.class));
    }
}
