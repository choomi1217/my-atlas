package com.myqaweb.convention;

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
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for ConventionController.
 */
@WebMvcTest(ConventionController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class ConventionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ConventionService conventionService;

    private final LocalDateTime now = LocalDateTime.of(2026, 3, 26, 10, 0, 0);

    // --- GET /api/conventions ---

    @Test
    void list_returnsOk() throws Exception {
        // Arrange
        List<ConventionDto.ConventionResponse> items = List.of(
                new ConventionDto.ConventionResponse(1L, "TC", "Test Case", "Testing", "/api/convention-images/tc.png", now, now),
                new ConventionDto.ConventionResponse(2L, "QA", "Quality Assurance", "General", null, now, null)
        );
        when(conventionService.findAll()).thenReturn(items);

        // Act & Assert
        mockMvc.perform(get("/api/conventions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].term").value("TC"))
                .andExpect(jsonPath("$.data[0].imageUrl").value("/api/convention-images/tc.png"))
                .andExpect(jsonPath("$.data[1].term").value("QA"))
                .andExpect(jsonPath("$.data[1].imageUrl").isEmpty());

        verify(conventionService).findAll();
    }

    // --- GET /api/conventions/{id} ---

    @Test
    void getById_returnsOk() throws Exception {
        // Arrange
        ConventionDto.ConventionResponse conv = new ConventionDto.ConventionResponse(
                1L, "TC", "Test Case", "Testing", "/api/convention-images/tc.png", now, now);
        when(conventionService.findById(1L)).thenReturn(Optional.of(conv));

        // Act & Assert
        mockMvc.perform(get("/api/conventions/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.term").value("TC"))
                .andExpect(jsonPath("$.data.definition").value("Test Case"))
                .andExpect(jsonPath("$.data.imageUrl").value("/api/convention-images/tc.png"));

        verify(conventionService).findById(1L);
    }

    @Test
    void getById_returns404WhenNotFound() throws Exception {
        // Arrange
        when(conventionService.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        mockMvc.perform(get("/api/conventions/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Convention not found"));

        verify(conventionService).findById(99L);
    }

    // --- POST /api/conventions ---

    @Test
    void create_returns201() throws Exception {
        // Arrange
        ConventionDto.ConventionResponse created = new ConventionDto.ConventionResponse(
                1L, "BDD", "Behavior Driven Development", "Methodology", null, now, now);
        when(conventionService.create(any(ConventionDto.ConventionRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/conventions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"term": "BDD", "definition": "Behavior Driven Development", "category": "Methodology"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Convention created"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.term").value("BDD"));

        verify(conventionService).create(any(ConventionDto.ConventionRequest.class));
    }

    @Test
    void create_withImageUrl_returns201() throws Exception {
        // Arrange
        String imageUrl = "/api/convention-images/bdd.png";
        ConventionDto.ConventionResponse created = new ConventionDto.ConventionResponse(
                1L, "BDD", "Behavior Driven Development", "Methodology", imageUrl, now, now);
        when(conventionService.create(any(ConventionDto.ConventionRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/conventions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"term": "BDD", "definition": "Behavior Driven Development", "category": "Methodology", "imageUrl": "/api/convention-images/bdd.png"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.imageUrl").value(imageUrl));

        verify(conventionService).create(any(ConventionDto.ConventionRequest.class));
    }

    @Test
    void create_returns400WhenTermBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/conventions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"term": "", "definition": "Some definition"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(conventionService, never()).create(any());
    }

    @Test
    void create_returns400WhenDefinitionBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/conventions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"term": "TC", "definition": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(conventionService, never()).create(any());
    }

    // --- PUT /api/conventions/{id} ---

    @Test
    void update_returnsOk() throws Exception {
        // Arrange
        ConventionDto.ConventionResponse updated = new ConventionDto.ConventionResponse(
                1L, "TC Updated", "Test Case Updated", "Testing", null, now, now);
        when(conventionService.update(eq(1L), any(ConventionDto.ConventionRequest.class))).thenReturn(updated);

        // Act & Assert
        mockMvc.perform(put("/api/conventions/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"term": "TC Updated", "definition": "Test Case Updated", "category": "Testing"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Convention updated"))
                .andExpect(jsonPath("$.data.term").value("TC Updated"));

        verify(conventionService).update(eq(1L), any(ConventionDto.ConventionRequest.class));
    }

    @Test
    void update_returns404WhenNotFound() throws Exception {
        // Arrange
        when(conventionService.update(eq(99L), any(ConventionDto.ConventionRequest.class)))
                .thenThrow(new IllegalArgumentException("Convention not found: 99"));

        // Act & Assert
        mockMvc.perform(put("/api/conventions/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"term": "TC", "definition": "Test Case"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Convention not found: 99"));
    }

    // --- DELETE /api/conventions/{id} ---

    @Test
    void delete_returnsOk() throws Exception {
        // Arrange
        doNothing().when(conventionService).delete(1L);

        // Act & Assert
        mockMvc.perform(delete("/api/conventions/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Convention deleted"));

        verify(conventionService).delete(1L);
    }

    @Test
    void delete_returns404WhenNotFound() throws Exception {
        // Arrange
        doThrow(new IllegalArgumentException("Convention not found: 99"))
                .when(conventionService).delete(99L);

        // Act & Assert
        mockMvc.perform(delete("/api/conventions/99"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Convention not found: 99"));
    }
}
