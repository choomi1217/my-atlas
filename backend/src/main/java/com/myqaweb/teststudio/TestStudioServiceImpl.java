package com.myqaweb.teststudio;

import com.myqaweb.feature.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Test Studio service implementation.
 * Validates input, persists job row, and delegates to TestStudioGenerator for async work.
 */
@Service
@RequiredArgsConstructor
public class TestStudioServiceImpl implements TestStudioService {

    private static final Logger log = LoggerFactory.getLogger(TestStudioServiceImpl.class);

    private static final int MAX_MARKDOWN_LENGTH = 100_000;
    private static final long MAX_PDF_BYTES = 20L * 1024 * 1024; // 20MB

    private final TestStudioJobRepository jobRepository;
    private final ProductRepository productRepository;
    private final TestStudioGenerator generator;

    @Override
    @Transactional
    public Long submitJob(Long productId, SourceType sourceType, String title,
                          String content, MultipartFile file) {
        if (productId == null) {
            throw new IllegalArgumentException("productId is required");
        }
        if (sourceType == null) {
            throw new IllegalArgumentException("sourceType is required");
        }
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        if (!productRepository.existsById(productId)) {
            throw new IllegalArgumentException("Product not found: " + productId);
        }

        byte[] pdfBytes = null;
        String markdownContent = null;
        String sourceFilePath = null;

        if (sourceType == SourceType.MARKDOWN) {
            if (content == null || content.isBlank()) {
                throw new IllegalArgumentException("Markdown content is required");
            }
            if (content.length() > MAX_MARKDOWN_LENGTH) {
                throw new IllegalArgumentException("문서 길이가 100,000자를 초과했습니다");
            }
            markdownContent = content;
        } else if (sourceType == SourceType.PDF) {
            if (file == null || file.isEmpty()) {
                throw new IllegalArgumentException("PDF file is required");
            }
            if (file.getSize() > MAX_PDF_BYTES) {
                throw new IllegalArgumentException("PDF 파일 크기가 20MB를 초과했습니다");
            }
            try {
                pdfBytes = file.getBytes();
            } catch (IOException e) {
                throw new IllegalArgumentException("Failed to read uploaded file: " + e.getMessage());
            }
            sourceFilePath = file.getOriginalFilename();
        }

        TestStudioJobEntity job = new TestStudioJobEntity();
        job.setProductId(productId);
        job.setSourceType(sourceType);
        job.setSourceTitle(title);
        job.setSourceContent(markdownContent);
        job.setSourceFilePath(sourceFilePath);
        job.setStatus(TestStudioJobStatus.PENDING);
        job.setGeneratedCount(0);
        TestStudioJobEntity saved = jobRepository.save(job);

        log.info("Test Studio job created: id={}, productId={}, sourceType={}, title='{}'",
                saved.getId(), productId, sourceType, title);

        // Kick off async generation
        generator.generate(saved.getId(), productId, sourceType, markdownContent, pdfBytes);

        return saved.getId();
    }

    @Override
    @Transactional(readOnly = true)
    public TestStudioJobDto.JobResponse getJob(Long id) {
        TestStudioJobEntity job = jobRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + id));
        return toResponse(job);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TestStudioJobDto.JobResponse> listJobs(Long productId) {
        if (productId == null) {
            throw new IllegalArgumentException("productId is required");
        }
        return jobRepository.findAllByProductIdOrderByCreatedAtDesc(productId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deleteJob(Long id) {
        if (!jobRepository.existsById(id)) {
            throw new IllegalArgumentException("Job not found: " + id);
        }
        // DRAFT TCs are preserved (test_case.test_studio_job_id FK is ON DELETE SET NULL)
        jobRepository.deleteById(id);
    }

    private TestStudioJobDto.JobResponse toResponse(TestStudioJobEntity entity) {
        return new TestStudioJobDto.JobResponse(
                entity.getId(),
                entity.getProductId(),
                entity.getSourceType(),
                entity.getSourceTitle(),
                entity.getStatus(),
                entity.getErrorMessage(),
                entity.getGeneratedCount(),
                entity.getCreatedAt(),
                entity.getCompletedAt()
        );
    }
}
