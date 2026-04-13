package com.myqaweb.knowledgebase;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PdfPipelineServiceImpl implements PdfPipelineService {

    private static final Logger log = LoggerFactory.getLogger(PdfPipelineServiceImpl.class);

    private final PdfUploadJobRepository jobRepository;
    private final KnowledgeBaseRepository kbRepository;
    private final PdfProcessingWorker pdfProcessingWorker;
    private final KbCategoryService categoryService;

    @Override
    public Long startUpload(MultipartFile file, String bookTitle, String category) {
        PdfUploadJobEntity job = new PdfUploadJobEntity();
        job.setBookTitle(bookTitle);
        job.setOriginalFilename(file.getOriginalFilename());
        job.setStatus("PENDING");
        PdfUploadJobEntity saved = jobRepository.save(job);

        // Auto-register category for autocomplete
        categoryService.ensureExists(category);

        byte[] pdfBytes;
        try {
            pdfBytes = file.getBytes();
        } catch (IOException e) {
            saved.setStatus("FAILED");
            saved.setErrorMessage("Failed to read uploaded file: " + e.getMessage());
            saved.setCompletedAt(LocalDateTime.now());
            jobRepository.save(saved);
            return saved.getId();
        }

        pdfProcessingWorker.processPdf(saved.getId(), pdfBytes, bookTitle, category);
        return saved.getId();
    }

    @Override
    @Transactional(readOnly = true)
    public PdfUploadJobDto.JobResponse getJob(Long jobId) {
        PdfUploadJobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
        return toJobResponse(job);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PdfUploadJobDto.JobResponse> getAllJobs() {
        return jobRepository.findAll().stream()
                .map(this::toJobResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deleteBook(String source) {
        // Soft Delete for PDF chunks (preserve original data)
        kbRepository.softDeleteBySource(source, LocalDateTime.now());
        // Keep job records for history
    }

    private PdfUploadJobDto.JobResponse toJobResponse(PdfUploadJobEntity entity) {
        return new PdfUploadJobDto.JobResponse(
                entity.getId(),
                entity.getBookTitle(),
                entity.getOriginalFilename(),
                entity.getStatus(),
                entity.getTotalChunks(),
                entity.getErrorMessage(),
                entity.getCreatedAt(),
                entity.getCompletedAt()
        );
    }
}
