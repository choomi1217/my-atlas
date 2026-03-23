package com.myqaweb.senior;

import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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
 * Controller tests for SeniorController — FAQ endpoints.
 * Skips chat endpoint (SSE streaming) which is complex to test via MockMvc.
 */
@WebMvcTest(SeniorController.class)
@Import(GlobalExceptionHandler.class)
class SeniorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SeniorService seniorService;

    private final LocalDateTime now = LocalDateTime.of(2026, 3, 23, 10, 0, 0);

    // --- GET /api/senior/faq ---

    @Test
    void listFaqs_returnsOkWithFaqList() throws Exception {
        // Arrange
        List<FaqDto.FaqResponse> faqs = List.of(
                new FaqDto.FaqResponse(1L, "FAQ 1", "Content 1", "tag1", now, now),
                new FaqDto.FaqResponse(2L, "FAQ 2", "Content 2", "tag2", now, now)
        );
        when(seniorService.findAllFaqs()).thenReturn(faqs);

        // Act & Assert
        mockMvc.perform(get("/api/senior/faq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].title").value("FAQ 1"))
                .andExpect(jsonPath("$.data[1].title").value("FAQ 2"));

        verify(seniorService).findAllFaqs();
    }

    @Test
    void listFaqs_returnsEmptyList() throws Exception {
        // Arrange
        when(seniorService.findAllFaqs()).thenReturn(List.of());

        // Act & Assert
        mockMvc.perform(get("/api/senior/faq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // --- GET /api/senior/faq/{id} ---

    @Test
    void getFaq_returnsOkWhenFound() throws Exception {
        // Arrange
        FaqDto.FaqResponse faq = new FaqDto.FaqResponse(1L, "Test FAQ", "Test content", "tags", now, now);
        when(seniorService.findFaqById(1L)).thenReturn(Optional.of(faq));

        // Act & Assert
        mockMvc.perform(get("/api/senior/faq/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.title").value("Test FAQ"))
                .andExpect(jsonPath("$.data.content").value("Test content"));

        verify(seniorService).findFaqById(1L);
    }

    @Test
    void getFaq_returns404WhenNotFound() throws Exception {
        // Arrange
        when(seniorService.findFaqById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        mockMvc.perform(get("/api/senior/faq/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("FAQ not found"));

        verify(seniorService).findFaqById(99L);
    }

    // --- POST /api/senior/faq ---

    @Test
    void createFaq_returns201WithCreatedFaq() throws Exception {
        // Arrange
        FaqDto.FaqResponse created = new FaqDto.FaqResponse(1L, "New FAQ", "Content here", "tag1", now, now);
        when(seniorService.createFaq(any(FaqDto.FaqRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/senior/faq")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "New FAQ", "content": "Content here", "tags": "tag1"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("FAQ created"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.title").value("New FAQ"));

        verify(seniorService).createFaq(any(FaqDto.FaqRequest.class));
    }

    @Test
    void createFaq_returns400WhenTitleBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/senior/faq")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "", "content": "Content here"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(seniorService, never()).createFaq(any());
    }

    @Test
    void createFaq_returns400WhenContentBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/senior/faq")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Valid title", "content": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(seniorService, never()).createFaq(any());
    }

    @Test
    void createFaq_returns400WhenTitleMissing() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/senior/faq")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content": "Only content, no title"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(seniorService, never()).createFaq(any());
    }

    // --- PUT /api/senior/faq/{id} ---

    @Test
    void updateFaq_returnsOkWithUpdatedFaq() throws Exception {
        // Arrange
        FaqDto.FaqResponse updated = new FaqDto.FaqResponse(1L, "Updated", "Updated content", "newtag", now, now);
        when(seniorService.updateFaq(eq(1L), any(FaqDto.FaqRequest.class))).thenReturn(updated);

        // Act & Assert
        mockMvc.perform(put("/api/senior/faq/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Updated", "content": "Updated content", "tags": "newtag"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("FAQ updated"))
                .andExpect(jsonPath("$.data.title").value("Updated"));

        verify(seniorService).updateFaq(eq(1L), any(FaqDto.FaqRequest.class));
    }

    @Test
    void updateFaq_returns404WhenNotFound() throws Exception {
        // Arrange
        when(seniorService.updateFaq(eq(99L), any(FaqDto.FaqRequest.class)))
                .thenThrow(new IllegalArgumentException("FAQ not found: 99"));

        // Act & Assert
        mockMvc.perform(put("/api/senior/faq/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Title", "content": "Content"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("FAQ not found: 99"));
    }

    @Test
    void updateFaq_returns400WhenValidationFails() throws Exception {
        // Act & Assert
        mockMvc.perform(put("/api/senior/faq/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "", "content": "Content"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(seniorService, never()).updateFaq(anyLong(), any());
    }

    // --- DELETE /api/senior/faq/{id} ---

    @Test
    void deleteFaq_returnsOkOnSuccess() throws Exception {
        // Arrange
        doNothing().when(seniorService).deleteFaq(1L);

        // Act & Assert
        mockMvc.perform(delete("/api/senior/faq/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("FAQ deleted"));

        verify(seniorService).deleteFaq(1L);
    }

    @Test
    void deleteFaq_returns404WhenNotFound() throws Exception {
        // Arrange
        doThrow(new IllegalArgumentException("FAQ not found: 99"))
                .when(seniorService).deleteFaq(99L);

        // Act & Assert
        mockMvc.perform(delete("/api/senior/faq/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("FAQ not found: 99"));
    }
}
