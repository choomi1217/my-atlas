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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for TestResultCommentController.
 */
@WebMvcTest(TestResultCommentController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class TestResultCommentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TestResultCommentService commentService;

    private static final String BASE_URL = "/api/versions/1/results/10/comments";

    // --- GET /api/versions/{versionId}/results/{resultId}/comments ---

    @Test
    void getComments_returnsOk() throws Exception {
        // Arrange
        TestResultCommentDto.CommentResponse child = new TestResultCommentDto.CommentResponse(
                2L, 10L, 1L, "Dev", "Reply", null,
                LocalDateTime.of(2026, 4, 1, 10, 0), LocalDateTime.of(2026, 4, 1, 10, 0),
                List.of()
        );
        TestResultCommentDto.CommentResponse parent = new TestResultCommentDto.CommentResponse(
                1L, 10L, null, "QA", "Top comment", null,
                LocalDateTime.of(2026, 4, 1, 9, 0), LocalDateTime.of(2026, 4, 1, 9, 0),
                List.of(child)
        );
        when(commentService.getCommentsByResultId(10L)).thenReturn(List.of(parent));

        // Act & Assert
        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].content").value("Top comment"))
                .andExpect(jsonPath("$.data[0].children.length()").value(1))
                .andExpect(jsonPath("$.data[0].children[0].id").value(2))
                .andExpect(jsonPath("$.data[0].children[0].content").value("Reply"));

        verify(commentService).getCommentsByResultId(10L);
    }

    @Test
    void getComments_returnsEmptyList() throws Exception {
        when(commentService.getCommentsByResultId(10L)).thenReturn(List.of());

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // --- POST /api/versions/{versionId}/results/{resultId}/comments ---

    @Test
    void addComment_returns201() throws Exception {
        // Arrange
        TestResultCommentDto.CommentResponse created = new TestResultCommentDto.CommentResponse(
                1L, 10L, null, "QA", "New comment", null,
                LocalDateTime.of(2026, 4, 1, 10, 0), LocalDateTime.of(2026, 4, 1, 10, 0),
                List.of()
        );
        when(commentService.addComment(eq(10L), any(TestResultCommentDto.CreateCommentRequest.class)))
                .thenReturn(created);

        // Act & Assert
        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"author": "QA", "content": "New comment"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.content").value("New comment"))
                .andExpect(jsonPath("$.data.author").value("QA"));

        verify(commentService).addComment(eq(10L), any(TestResultCommentDto.CreateCommentRequest.class));
    }

    @Test
    void addComment_returns400WhenContentBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"author": "QA", "content": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(commentService, never()).addComment(anyLong(), any());
    }

    @Test
    void addComment_returns400WhenTestResultNotFound() throws Exception {
        when(commentService.addComment(eq(10L), any(TestResultCommentDto.CreateCommentRequest.class)))
                .thenThrow(new IllegalArgumentException("TestResult not found: 10"));

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"author": "QA", "content": "comment text"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- DELETE /api/versions/{versionId}/results/{resultId}/comments/{commentId} ---

    @Test
    void deleteComment_returnsOk() throws Exception {
        doNothing().when(commentService).deleteComment(1L);

        mockMvc.perform(delete(BASE_URL + "/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Comment deleted"));

        verify(commentService).deleteComment(1L);
    }

    @Test
    void deleteComment_returns400WhenNotFound() throws Exception {
        doThrow(new IllegalArgumentException("Comment not found: 99"))
                .when(commentService).deleteComment(99L);

        mockMvc.perform(delete(BASE_URL + "/99"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
