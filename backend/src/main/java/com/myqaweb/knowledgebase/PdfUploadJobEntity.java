package com.myqaweb.knowledgebase;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "pdf_upload_job")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PdfUploadJobEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "book_title", nullable = false, length = 200)
    private String bookTitle;

    @Column(name = "original_filename", nullable = false, length = 300)
    private String originalFilename;

    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "total_chunks")
    private Integer totalChunks;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
