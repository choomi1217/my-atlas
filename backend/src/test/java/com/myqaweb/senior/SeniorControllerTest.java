package com.myqaweb.senior;

import com.myqaweb.common.GlobalExceptionHandler;
import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for SeniorController — curated FAQ endpoint (KB-based).
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

    // --- GET /api/senior/faq (Curated FAQ — KB-based) ---

    @Test
    void listFaqs_returnsOkWithCuratedKbList() throws Exception {
        // Arrange
        List<KnowledgeBaseDto.KbResponse> faqs = List.of(
                new KnowledgeBaseDto.KbResponse(1L, "Pinned KB Entry", "Content 1",
                        "QA", "tag1", null, 0, now, now, now),
                new KnowledgeBaseDto.KbResponse(2L, "Top Hit Entry", "Content 2",
                        "API", "tag2", null, 10, null, now, now)
        );
        when(seniorService.getCuratedFaqs()).thenReturn(faqs);

        // Act & Assert
        mockMvc.perform(get("/api/senior/faq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].title").value("Pinned KB Entry"))
                .andExpect(jsonPath("$.data[0].hitCount").value(0))
                .andExpect(jsonPath("$.data[0].pinnedAt").exists())
                .andExpect(jsonPath("$.data[1].title").value("Top Hit Entry"))
                .andExpect(jsonPath("$.data[1].hitCount").value(10))
                .andExpect(jsonPath("$.data[1].pinnedAt").doesNotExist());

        verify(seniorService).getCuratedFaqs();
    }

    @Test
    void listFaqs_returnsEmptyList() throws Exception {
        // Arrange
        when(seniorService.getCuratedFaqs()).thenReturn(List.of());

        // Act & Assert
        mockMvc.perform(get("/api/senior/faq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));

        verify(seniorService).getCuratedFaqs();
    }

    @Test
    void listFaqs_responseContainsKbResponseFields() throws Exception {
        // Arrange — verify that the response includes KB-specific fields (source, hitCount, pinnedAt)
        List<KnowledgeBaseDto.KbResponse> faqs = List.of(
                new KnowledgeBaseDto.KbResponse(5L, "KB Entry", "Content", "Category",
                        "tags", "book-source", 3, now, now, now)
        );
        when(seniorService.getCuratedFaqs()).thenReturn(faqs);

        // Act & Assert
        mockMvc.perform(get("/api/senior/faq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(5))
                .andExpect(jsonPath("$.data[0].title").value("KB Entry"))
                .andExpect(jsonPath("$.data[0].content").value("Content"))
                .andExpect(jsonPath("$.data[0].category").value("Category"))
                .andExpect(jsonPath("$.data[0].tags").value("tags"))
                .andExpect(jsonPath("$.data[0].source").value("book-source"))
                .andExpect(jsonPath("$.data[0].hitCount").value(3))
                .andExpect(jsonPath("$.data[0].pinnedAt").exists());

        verify(seniorService).getCuratedFaqs();
    }
}
