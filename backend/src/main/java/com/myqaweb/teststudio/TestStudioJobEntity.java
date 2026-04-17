package com.myqaweb.teststudio;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Test Studio Job entity.
 * Tracks asynchronous document-to-TC generation jobs.
 */
@Entity
@Table(name = "test_studio_job")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestStudioJobEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private SourceType sourceType;

    @Column(name = "source_title", nullable = false, length = 200)
    private String sourceTitle;

    @Column(name = "source_content", columnDefinition = "TEXT")
    private String sourceContent;

    @Column(name = "source_file_path", length = 500)
    private String sourceFilePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TestStudioJobStatus status = TestStudioJobStatus.PENDING;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "generated_count", nullable = false)
    private Integer generatedCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = TestStudioJobStatus.PENDING;
        }
        if (generatedCount == null) {
            generatedCount = 0;
        }
    }
}
