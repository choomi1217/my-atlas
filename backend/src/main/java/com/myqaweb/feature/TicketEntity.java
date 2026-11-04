package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Ticket entity representing a Notion page or Jira issue reference linked to a test result.
 */
@Entity
@Table(name = "ticket")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TicketEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_result_id", nullable = false)
    private TestResultEntity testResult;

    @Column(name = "issue_key", nullable = false, length = 50)
    private String issueKey;

    @Column(name = "issue_url", nullable = false, length = 500)
    private String issueUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TicketTracker tracker = TicketTracker.NOTION;

    @Column(nullable = false, length = 500)
    private String summary;

    @Column(nullable = false, length = 50)
    private String status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TicketPriority priority = TicketPriority.MEDIUM;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "reopen_count", nullable = false)
    private Integer reopenCount = 0;

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
