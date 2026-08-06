package com.myqaweb.teststudio;

import com.myqaweb.feature.Priority;
import com.myqaweb.feature.TestStep;
import com.myqaweb.feature.TestType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Test Studio v2.5 — 스타일 세트에 속한 예시 TC (verbatim).
 *
 * <p>사용자가 팀 방식대로 직접 작성한 대표 TC. 생성 시 원문 그대로 few-shot으로 주입된다.
 * 컬럼은 {@link com.myqaweb.feature.TestCaseEntity}와 동형(steps/expectedResults는 JSONB)이라
 * 프론트의 TC 작성 폼을 재사용하지만, Company-scoped이며 운영 Test Suite에는 노출되지 않는다.
 */
@Entity
@Table(name = "test_studio_style_example")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestStudioStyleExampleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "profile_id", nullable = false)
    private Long profileId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String preconditions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSONB")
    private List<TestStep> steps;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "expected_results", columnDefinition = "JSONB")
    private List<String> expectedResults;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Priority priority;

    @Enumerated(EnumType.STRING)
    @Column(name = "test_type", length = 20)
    private TestType testType;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (sortOrder == null) {
            sortOrder = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
