package com.myqaweb.teststudio;

import com.myqaweb.feature.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TestStudioServiceImpl}.
 * Verifies input validation and delegation to {@link TestStudioGenerator}.
 */
@ExtendWith(MockitoExtension.class)
class TestStudioServiceImplTest {

    @Mock
    private TestStudioJobRepository jobRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private TestStudioGenerator generator;

    @InjectMocks
    private TestStudioServiceImpl service;

    private TestStudioJobEntity savedJob;

    @BeforeEach
    void setUp() {
        savedJob = new TestStudioJobEntity();
        savedJob.setId(42L);
        savedJob.setProductId(1L);
        savedJob.setSourceType(SourceType.MARKDOWN);
        savedJob.setSourceTitle("Title");
        savedJob.setStatus(TestStudioJobStatus.PENDING);
        savedJob.setGeneratedCount(0);
        savedJob.setCreatedAt(LocalDateTime.now());
    }

    // --- submitJob (MARKDOWN) ---

    @Test
    void submitJob_markdown_savesPendingJobAndInvokesGenerator() {
        // Arrange
        when(productRepository.existsById(1L)).thenReturn(true);
        when(jobRepository.save(any(TestStudioJobEntity.class))).thenReturn(savedJob);

        // Act
        Long jobId = service.submitJob(1L, SourceType.MARKDOWN, "My Title", "# Heading\n\nBody", null);

        // Assert
        assertEquals(42L, jobId);

        ArgumentCaptor<TestStudioJobEntity> jobCaptor = ArgumentCaptor.forClass(TestStudioJobEntity.class);
        verify(jobRepository).save(jobCaptor.capture());
        TestStudioJobEntity persisted = jobCaptor.getValue();
        assertEquals(1L, persisted.getProductId());
        assertEquals(SourceType.MARKDOWN, persisted.getSourceType());
        assertEquals("My Title", persisted.getSourceTitle());
        assertEquals("# Heading\n\nBody", persisted.getSourceContent());
        assertNull(persisted.getSourceFilePath());
        assertEquals(TestStudioJobStatus.PENDING, persisted.getStatus());
        assertEquals(0, persisted.getGeneratedCount());

        verify(generator).generate(eq(42L), eq(1L), eq(SourceType.MARKDOWN),
                eq("# Heading\n\nBody"), eq(null));
    }

    @Test
    void submitJob_pdf_savesPendingJobWithFilename() {
        // Arrange
        byte[] pdfContent = "%PDF-1.4 fake".getBytes();
        MultipartFile file = new MockMultipartFile("file", "spec.pdf", "application/pdf", pdfContent);
        when(productRepository.existsById(1L)).thenReturn(true);
        when(jobRepository.save(any(TestStudioJobEntity.class))).thenAnswer(inv -> {
            TestStudioJobEntity e = inv.getArgument(0);
            e.setId(77L);
            return e;
        });

        // Act
        Long jobId = service.submitJob(1L, SourceType.PDF, "PDF Title", null, file);

        // Assert
        assertEquals(77L, jobId);

        ArgumentCaptor<TestStudioJobEntity> jobCaptor = ArgumentCaptor.forClass(TestStudioJobEntity.class);
        verify(jobRepository).save(jobCaptor.capture());
        TestStudioJobEntity persisted = jobCaptor.getValue();
        assertEquals(SourceType.PDF, persisted.getSourceType());
        assertEquals("spec.pdf", persisted.getSourceFilePath());
        assertNull(persisted.getSourceContent());

        verify(generator).generate(eq(77L), eq(1L), eq(SourceType.PDF), eq(null), eq(pdfContent));
    }

    // --- Validation errors ---

    @Test
    void submitJob_rejectsWhenProductIdNull() {
        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(null, SourceType.MARKDOWN, "T", "content", null));
        verifyNoInteractions(generator);
        verify(jobRepository, never()).save(any());
    }

    @Test
    void submitJob_rejectsWhenSourceTypeNull() {
        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, null, "T", "content", null));
        verifyNoInteractions(generator);
    }

    @Test
    void submitJob_rejectsWhenTitleBlank() {
        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, SourceType.MARKDOWN, "   ", "content", null));
        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, SourceType.MARKDOWN, null, "content", null));
        verifyNoInteractions(generator);
    }

    @Test
    void submitJob_rejectsWhenProductNotFound() {
        when(productRepository.existsById(99L)).thenReturn(false);

        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(99L, SourceType.MARKDOWN, "T", "content", null));
        verify(jobRepository, never()).save(any());
        verifyNoInteractions(generator);
    }

    @Test
    void submitJob_rejectsWhenMarkdownContentNull() {
        when(productRepository.existsById(1L)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, SourceType.MARKDOWN, "T", null, null));
        verifyNoInteractions(generator);
    }

    @Test
    void submitJob_rejectsWhenMarkdownContentBlank() {
        when(productRepository.existsById(1L)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, SourceType.MARKDOWN, "T", "   ", null));
    }

    @Test
    void submitJob_rejectsWhenMarkdownContentTooLong() {
        when(productRepository.existsById(1L)).thenReturn(true);

        String tooLong = "a".repeat(100_001);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, SourceType.MARKDOWN, "T", tooLong, null));
        assertTrue(ex.getMessage().contains("100,000"),
                "Error message should mention 100,000 char limit, was: " + ex.getMessage());
        verifyNoInteractions(generator);
    }

    @Test
    void submitJob_rejectsWhenPdfFileNull() {
        when(productRepository.existsById(1L)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, SourceType.PDF, "T", null, null));
        verifyNoInteractions(generator);
    }

    @Test
    void submitJob_rejectsWhenPdfFileEmpty() {
        when(productRepository.existsById(1L)).thenReturn(true);
        MultipartFile emptyFile = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);

        assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, SourceType.PDF, "T", null, emptyFile));
        verifyNoInteractions(generator);
    }

    @Test
    void submitJob_rejectsWhenPdfFileTooLarge() {
        // Arrange — mock MultipartFile to avoid allocating 20MB of actual bytes
        when(productRepository.existsById(1L)).thenReturn(true);
        MultipartFile bigFile = mock(MultipartFile.class);
        when(bigFile.isEmpty()).thenReturn(false);
        when(bigFile.getSize()).thenReturn(20L * 1024 * 1024 + 1);

        // Act & Assert
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.submitJob(1L, SourceType.PDF, "T", null, bigFile));
        assertTrue(ex.getMessage().contains("20MB"),
                "Error message should mention 20MB, was: " + ex.getMessage());
        verifyNoInteractions(generator);
        verify(jobRepository, never()).save(any());
    }

    // --- getJob ---

    @Test
    void getJob_returnsDto() {
        when(jobRepository.findById(42L)).thenReturn(Optional.of(savedJob));

        TestStudioJobDto.JobResponse resp = service.getJob(42L);

        assertEquals(42L, resp.id());
        assertEquals(1L, resp.productId());
        assertEquals(SourceType.MARKDOWN, resp.sourceType());
        assertEquals("Title", resp.sourceTitle());
        assertEquals(TestStudioJobStatus.PENDING, resp.status());
        assertEquals(0, resp.generatedCount());
    }

    @Test
    void getJob_throwsWhenNotFound() {
        when(jobRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.getJob(99L));
    }

    // --- listJobs ---

    @Test
    void listJobs_returnsOrderedList() {
        TestStudioJobEntity j2 = new TestStudioJobEntity();
        j2.setId(2L);
        j2.setProductId(1L);
        j2.setSourceType(SourceType.PDF);
        j2.setSourceTitle("Second");
        j2.setStatus(TestStudioJobStatus.DONE);
        j2.setGeneratedCount(3);
        j2.setCreatedAt(LocalDateTime.now());

        when(jobRepository.findAllByProductIdOrderByCreatedAtDesc(1L))
                .thenReturn(List.of(savedJob, j2));

        List<TestStudioJobDto.JobResponse> result = service.listJobs(1L);

        assertEquals(2, result.size());
        assertEquals("Title", result.get(0).sourceTitle());
        assertEquals("Second", result.get(1).sourceTitle());
        verify(jobRepository).findAllByProductIdOrderByCreatedAtDesc(1L);
    }

    @Test
    void listJobs_rejectsWhenProductIdNull() {
        assertThrows(IllegalArgumentException.class, () -> service.listJobs(null));
    }

    // --- deleteJob ---

    @Test
    void deleteJob_callsRepository() {
        when(jobRepository.existsById(42L)).thenReturn(true);

        service.deleteJob(42L);

        verify(jobRepository).deleteById(42L);
    }

    @Test
    void deleteJob_throwsWhenNotFound() {
        when(jobRepository.existsById(99L)).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> service.deleteJob(99L));
        verify(jobRepository, never()).deleteById(anyLong());
    }
}
