package com.myqaweb.teststudio;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Test Studio v2.5 — 스타일 세트(프로필).
 *
 * <p>사용자가 이름 붙여 만드는 예시 TC 묶음. Company별로 여러 개 존재하며, 활성 세트는
 * {@link TestStudioConfigEntity#getSelectedProfileId()}로 선택된다. 기본 견본(Sample, 로그인)은
 * 이 테이블의 row가 아니라 코드 상수({@code DefaultStyleSamples})로 제공된다.
 */
@Entity
@Table(name = "test_studio_style_profile")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestStudioStyleProfileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(nullable = false, length = 100)
    private String name;

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
