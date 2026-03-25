package com.myqaweb.knowledgebase;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for PdfPipelineServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
class PdfPipelineServiceImplTest {

    @Mock
    private PdfUploadJobRepository jobRepository;

    @Mock
    private KnowledgeBaseRepository kbRepository;

    @Mock
    private PdfProcessingWorker pdfProcessingWorker;

    @InjectMocks
    private PdfPipelineServiceImpl pdfPipelineService;

    private PdfUploadJobEntity sampleJob;

    @BeforeEach
    void setUp() {
        sampleJob = new PdfUploadJobEntity();
        sampleJob.setId(1L);
        sampleJob.setBookTitle("테스트 도서");
        sampleJob.setOriginalFilename("test.pdf");
        sampleJob.setStatus("DONE");
        sampleJob.setTotalChunks(10);
        sampleJob.setCreatedAt(LocalDateTime.now());
        sampleJob.setCompletedAt(LocalDateTime.now());
    }

    // --- getJob ---

    @Test
    void getJob_returnsJobWhenExists() {
        when(jobRepository.findById(1L)).thenReturn(Optional.of(sampleJob));

        PdfUploadJobDto.JobResponse result = pdfPipelineService.getJob(1L);

        assertNotNull(result);
        assertEquals("테스트 도서", result.bookTitle());
        assertEquals("DONE", result.status());
        assertEquals(10, result.totalChunks());
        verify(jobRepository).findById(1L);
    }

    @Test
    void getJob_throwsWhenNotFound() {
        when(jobRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> pdfPipelineService.getJob(99L));
    }

    // --- getAllJobs ---

    @Test
    void getAllJobs_returnsAllJobs() {
        when(jobRepository.findAll()).thenReturn(List.of(sampleJob));

        List<PdfUploadJobDto.JobResponse> result = pdfPipelineService.getAllJobs();

        assertEquals(1, result.size());
        assertEquals("테스트 도서", result.getFirst().bookTitle());
    }

    // --- deleteBook ---

    @Test
    void deleteBook_deletesChunksAndJobs() {
        pdfPipelineService.deleteBook("테스트 도서");

        verify(kbRepository).deleteBySource("테스트 도서");
        verify(jobRepository).deleteByBookTitle("테스트 도서");
    }

    // --- Response mapping ---

    @Test
    void getJob_mapsAllFieldsCorrectly() {
        when(jobRepository.findById(1L)).thenReturn(Optional.of(sampleJob));

        PdfUploadJobDto.JobResponse result = pdfPipelineService.getJob(1L);

        assertEquals(1L, result.id());
        assertEquals("테스트 도서", result.bookTitle());
        assertEquals("test.pdf", result.originalFilename());
        assertEquals("DONE", result.status());
        assertEquals(10, result.totalChunks());
        assertNotNull(result.createdAt());
        assertNotNull(result.completedAt());
    }
}
