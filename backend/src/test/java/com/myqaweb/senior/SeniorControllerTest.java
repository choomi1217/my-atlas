package com.myqaweb.senior;

import com.myqaweb.common.GlobalExceptionHandler;
import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.springframework.http.MediaType;

/**
 * Controller tests for SeniorController — curated FAQ endpoint (KB-based).
 * Skips chat endpoint (SSE streaming) which is complex to test via MockMvc.
 */
@WebMvcTest(SeniorController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class SeniorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SeniorService seniorService;

    @MockBean
    private ChatSessionService chatSessionService;

    private final LocalDateTime now = LocalDateTime.of(2026, 3, 23, 10, 0, 0);

    // --- GET /api/senior/faq (Curated FAQ — KB-based) ---

    @Test
    void listFaqs_returnsOkWithCuratedKbList() throws Exception {
        // Arrange
        List<KnowledgeBaseDto.KbResponse> faqs = List.of(
                new KnowledgeBaseDto.KbResponse(1L, "Pinned KB Entry", "Content 1",
                        "QA", null, 0, now, now, now, null),
                new KnowledgeBaseDto.KbResponse(2L, "Top Hit Entry", "Content 2",
                        "API", null, 10, null, now, now, null)
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
                        "book-source", 3, now, now, now, null)
        );
        when(seniorService.getCuratedFaqs()).thenReturn(faqs);

        // Act & Assert
        mockMvc.perform(get("/api/senior/faq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(5))
                .andExpect(jsonPath("$.data[0].title").value("KB Entry"))
                .andExpect(jsonPath("$.data[0].content").value("Content"))
                .andExpect(jsonPath("$.data[0].category").value("Category"))
                .andExpect(jsonPath("$.data[0].source").value("book-source"))
                .andExpect(jsonPath("$.data[0].hitCount").value(3))
                .andExpect(jsonPath("$.data[0].pinnedAt").exists());

        verify(seniorService).getCuratedFaqs();
    }

    // --- GET /api/senior/sessions ---

    @Test
    void listSessions_returnsOkWithSessionList() throws Exception {
        List<ChatSessionDto.SessionResponse> sessions = List.of(
                new ChatSessionDto.SessionResponse(1L, "Session 1", now, now),
                new ChatSessionDto.SessionResponse(2L, "Session 2", now, now)
        );
        when(chatSessionService.findAllSessions()).thenReturn(sessions);

        mockMvc.perform(get("/api/senior/sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].title").value("Session 1"));

        verify(chatSessionService).findAllSessions();
    }

    // --- GET /api/senior/sessions/{id} ---

    @Test
    void getSession_returnsSessionWithMessages() throws Exception {
        ChatSessionDto.SessionDetailResponse detail = new ChatSessionDto.SessionDetailResponse(
                1L, "Test Session",
                List.of(
                        new ChatSessionDto.MessageResponse(1L, "user", "Hello", now),
                        new ChatSessionDto.MessageResponse(2L, "assistant", "Hi!", now)
                ),
                now, now
        );
        when(chatSessionService.findSessionById(1L)).thenReturn(detail);

        mockMvc.perform(get("/api/senior/sessions/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Test Session"))
                .andExpect(jsonPath("$.data.messages.length()").value(2));

        verify(chatSessionService).findSessionById(1L);
    }

    // --- POST /api/senior/sessions ---

    @Test
    void createSession_returnsCreatedSession() throws Exception {
        ChatSessionDto.SessionResponse newSession = new ChatSessionDto.SessionResponse(1L, null, now, now);
        when(chatSessionService.createSession()).thenReturn(newSession);

        mockMvc.perform(post("/api/senior/sessions"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(1));

        verify(chatSessionService).createSession();
    }

    // --- PATCH /api/senior/sessions/{id} ---

    @Test
    void updateSessionTitle_returnsUpdatedSession() throws Exception {
        ChatSessionDto.SessionResponse updated = new ChatSessionDto.SessionResponse(1L, "New Title", now, now);
        when(chatSessionService.updateSessionTitle(eq(1L), eq("New Title"))).thenReturn(updated);

        mockMvc.perform(patch("/api/senior/sessions/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"New Title\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("New Title"));

        verify(chatSessionService).updateSessionTitle(1L, "New Title");
    }

    // --- DELETE /api/senior/sessions/{id} ---

    @Test
    void deleteSession_returnsOk() throws Exception {
        doNothing().when(chatSessionService).deleteSession(1L);

        mockMvc.perform(delete("/api/senior/sessions/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(chatSessionService).deleteSession(1L);
    }
}
