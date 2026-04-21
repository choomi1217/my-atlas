package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "test_case")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestCaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "bigint[]")
    private Long[] path;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "suggested_segment_path", columnDefinition = "text[]")
    private String[] suggestedSegmentPath;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "prompt_text", columnDefinition = "TEXT")
    private String promptText;

    @Column(columnDefinition = "TEXT")
    private String preconditions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSONB", nullable = false)
    private List<TestStep> steps;

    @Column(columnDefinition = "TEXT")
    private String expectedResult;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority = Priority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TestType testType = TestType.FUNCTIONAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TestStatus status = TestStatus.DRAFT;

    @Column(name = "test_studio_job_id")
    private Long testStudioJobId;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
