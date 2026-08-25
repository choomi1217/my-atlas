package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Product entity representing a product within a company.
 */
@Entity
@Table(name = "product")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private CompanyEntity company;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Platform platform;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "jira_project_key", length = 20)
    private String jiraProjectKey;

    /** 에이전트 실행 프로파일: 대상 baseUrl (registry_v20) */
    @Column(name = "exec_base_url", length = 500)
    private String execBaseUrl;

    /** 에이전트 실행 프로파일: 로그인/seed 절차 서술 (비밀값 저장 금지) */
    @Column(name = "exec_seed_note", columnDefinition = "TEXT")
    private String execSeedNote;

    /**
     * 에이전트 실행 대상 종류 (registry_v24 Step 8).
     * 제품 분류인 {@link #platform}과 별개다 — 워커는 자기가 구동 가능한 종류의 Job만 집는다.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "exec_target_kind", length = 20, nullable = false)
    private ExecTargetKind execTargetKind = ExecTargetKind.WEB;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
