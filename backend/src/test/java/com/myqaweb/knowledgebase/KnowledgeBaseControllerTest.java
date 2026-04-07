package com.myqaweb.knowledgebase;

import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
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
 * Controller tests for KnowledgeBaseController.
 */
@WebMvcTest(KnowledgeBaseController.class)
@Import(GlobalExceptionHandler.class)
class KnowledgeBaseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private KnowledgeBaseService knowledgeBaseService;

    @MockBean
    private PdfPipelineService pdfPipelineService;

    private final LocalDateTime now = LocalDateTime.of(2026, 3, 26, 10, 0, 0);

    // --- GET /api/kb ---

    @Test
    void list_returnsOkWithItems() throws Exception {
        // Arrange
        List<KnowledgeBaseDto.KbResponse> items = List.of(
                new KnowledgeBaseDto.KbResponse(1L, "Regression Testing", "Best practices",
                        "Testing", "regression", null, now, now),
                new KnowledgeBaseDto.KbResponse(2L, "API Testing", "How to test REST APIs",
                        "API", "api", null, now, now)
        );
        when(knowledgeBaseService.findAll()).thenReturn(items);

        // Act & Assert
        mockMvc.perform(get("/api/kb"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].title").value("Regression Testing"));

        verify(knowledgeBaseService).findAll();
    }

    // --- GET /api/kb/{id} ---

    @Test
    void getById_returnsOk() throws Exception {
        // Arrange
        KnowledgeBaseDto.KbResponse kb = new KnowledgeBaseDto.KbResponse(
                1L, "Regression Testing", "Best practices", "Testing", "regression", null, now, now);
        when(knowledgeBaseService.findById(1L)).thenReturn(Optional.of(kb));

        // Act & Assert
        mockMvc.perform(get("/api/kb/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.title").value("Regression Testing"));

        verify(knowledgeBaseService).findById(1L);
    }

    @Test
    void getById_returns404WhenNotFound() throws Exception {
        // Arrange
        when(knowledgeBaseService.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        mockMvc.perform(get("/api/kb/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Knowledge Base entry not found"));
    }

    // --- POST /api/kb ---

    @Test
    void create_returns201() throws Exception {
        // Arrange
        KnowledgeBaseDto.KbResponse created = new KnowledgeBaseDto.KbResponse(
                1L, "New Article", "Content", "QA", "qa", null, now, now);
        when(knowledgeBaseService.create(any(KnowledgeBaseDto.KbRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/kb")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "New Article", "content": "Content", "category": "QA", "tags": "qa"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Knowledge Base entry created"))
                .andExpect(jsonPath("$.data.title").value("New Article"));

        verify(knowledgeBaseService).create(any(KnowledgeBaseDto.KbRequest.class));
    }

    @Test
    void create_returns400WhenTitleBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/kb")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "", "content": "Content"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(knowledgeBaseService, never()).create(any());
    }

    @Test
    void create_returns400WhenContentBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/kb")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Title", "content": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(knowledgeBaseService, never()).create(any());
    }

    // --- PUT /api/kb/{id} ---

    @Test
    void update_returnsOk() throws Exception {
        // Arrange
        KnowledgeBaseDto.KbResponse updated = new KnowledgeBaseDto.KbResponse(
                1L, "Updated", "Updated Content", "QA", "qa", null, now, now);
        when(knowledgeBaseService.update(eq(1L), any(KnowledgeBaseDto.KbRequest.class))).thenReturn(updated);

        // Act & Assert
        mockMvc.perform(put("/api/kb/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Updated", "content": "Updated Content", "category": "QA"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Updated"));

        verify(knowledgeBaseService).update(eq(1L), any(KnowledgeBaseDto.KbRequest.class));
    }

    @Test
    void update_returns404WhenNotFound() throws Exception {
        // Arrange
        when(knowledgeBaseService.update(eq(99L), any(KnowledgeBaseDto.KbRequest.class)))
                .thenThrow(new IllegalArgumentException("Knowledge Base entry not found: 99"));

        // Act & Assert
        mockMvc.perform(put("/api/kb/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "T", "content": "C"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- DELETE /api/kb/{id} ---

    @Test
    void delete_returnsOk() throws Exception {
        // Arrange
        doNothing().when(knowledgeBaseService).delete(1L);

        // Act & Assert
        mockMvc.perform(delete("/api/kb/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Knowledge Base entry deleted"));

        verify(knowledgeBaseService).delete(1L);
    }

    // --- POST /api/kb/upload-pdf ---

    @Test
    void uploadPdf_returns201WithJobId() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "test-book.pdf", "application/pdf", "PDF content".getBytes());
        when(pdfPipelineService.startUpload(any(), eq("Test Book"))).thenReturn(42L);

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/upload-pdf")
                        .file(file)
                        .param("bookTitle", "Test Book"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.jobId").value(42));

        verify(pdfPipelineService).startUpload(any(), eq("Test Book"));
    }

    @Test
    void uploadPdf_returns400WhenFileEmpty() throws Exception {
        // Arrange
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.pdf", "application/pdf", new byte[0]);

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/upload-pdf")
                        .file(emptyFile)
                        .param("bookTitle", "Empty Book"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("File is empty"));

        verify(pdfPipelineService, never()).startUpload(any(), any());
    }

    // --- GET /api/kb/jobs/{jobId} ---

    @Test
    void getJob_returnsJobStatus() throws Exception {
        // Arrange
        PdfUploadJobDto.JobResponse job = new PdfUploadJobDto.JobResponse(
                1L, "Test Book", "test.pdf", "PROCESSING", null, null, now, null);
        when(pdfPipelineService.getJob(1L)).thenReturn(job);

        // Act & Assert
        mockMvc.perform(get("/api/kb/jobs/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.status").value("PROCESSING"))
                .andExpect(jsonPath("$.data.bookTitle").value("Test Book"));

        verify(pdfPipelineService).getJob(1L);
    }

    // --- GET /api/kb/jobs ---

    @Test
    void getAllJobs_returnsJobList() throws Exception {
        // Arrange
        List<PdfUploadJobDto.JobResponse> jobs = List.of(
                new PdfUploadJobDto.JobResponse(1L, "Book A", "a.pdf", "DONE", 10, null, now, now),
                new PdfUploadJobDto.JobResponse(2L, "Book B", "b.pdf", "PENDING", null, null, now, null)
        );
        when(pdfPipelineService.getAllJobs()).thenReturn(jobs);

        // Act & Assert
        mockMvc.perform(get("/api/kb/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].status").value("DONE"))
                .andExpect(jsonPath("$.data[1].status").value("PENDING"));

        verify(pdfPipelineService).getAllJobs();
    }

    // --- DELETE /api/kb/books/{source} ---

    @Test
    void deleteBook_returnsOk() throws Exception {
        // Arrange
        doNothing().when(pdfPipelineService).deleteBook("Test Book");

        // Act & Assert
        mockMvc.perform(delete("/api/kb/books/Test Book"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Book and all chunks deleted"));

        verify(pdfPipelineService).deleteBook("Test Book");
    }
}
