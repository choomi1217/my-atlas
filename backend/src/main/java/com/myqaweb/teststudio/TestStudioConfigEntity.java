package com.myqaweb.teststudio;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Test Studio v2.5 — Company별 보조 설정 + 활성 스타일 세트 선택 (Company 1:1).
 *
 * <p>{@code selectedProfileId}가 활성 세트를 가리키며, {@code null}이면 기본 견본
 * (Sample, 로그인)을 사용한다. enum 세 값은 스타일 예시가 없을 때의 약한 힌트다.
 */
@Entity
@Table(name = "test_studio_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestStudioConfigEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false, unique = true)
    private Long companyId;

    /** 활성 스타일 세트 id. null = 기본 견본(Sample) 사용. */
    @Column(name = "selected_profile_id")
    private Long selectedProfileId;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_format", nullable = false, length = 30)
    private StepFormat stepFormat = StepFormat.ACTION_EXPECTED;

    @Enumerated(EnumType.STRING)
    @Column(name = "detail_level", nullable = false, length = 20)
    private DetailLevel detailLevel = DetailLevel.STANDARD;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Tone tone = Tone.PLAIN;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
