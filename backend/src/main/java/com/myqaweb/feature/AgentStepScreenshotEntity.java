package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Step 스크린샷 증적 (registry_v31). (job, TC, step) 당 1장, 재업로드는 덮어쓴다.
 * data는 {@code @Lob} 없이 byte[] — bytea로 매핑된다 (@Lob이면 oid로 잡혀 깨진다).
 */
@Entity
@Table(name = "agent_step_screenshot")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentStepScreenshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Column(name = "test_case_id", nullable = false)
    private Long testCaseId;

    /** 0 = 앱 진입·전제조건 */
    @Column(name = "step_order", nullable = false)
    private Integer stepOrder;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Column(nullable = false)
    private byte[] data;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
