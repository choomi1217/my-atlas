package com.myqaweb.feature;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Ticket service implementation — delegates to Jira API for all ticket operations.
 */
@Service
public class TicketServiceImpl implements TicketService {

    private static final Logger log = LoggerFactory.getLogger(TicketServiceImpl.class);

    private final TicketRepository ticketRepository;
    private final TestResultRepository testResultRepository;
    private final JiraService jiraService;
    private final JiraConfig jiraConfig;
    private final ProductRepository productRepository;
    private final VersionRepository versionRepository;

    public TicketServiceImpl(TicketRepository ticketRepository,
                             TestResultRepository testResultRepository,
                             JiraService jiraService,
                             JiraConfig jiraConfig,
                             ProductRepository productRepository,
                             VersionRepository versionRepository) {
        this.ticketRepository = ticketRepository;
        this.testResultRepository = testResultRepository;
        this.jiraService = jiraService;
        this.jiraConfig = jiraConfig;
        this.productRepository = productRepository;
        this.versionRepository = versionRepository;
    }

    @Override
    @Transactional
    public TicketDto.TicketResponse createTicket(Long resultId, TicketDto.CreateTicketRequest request) {
        if (!jiraService.isConfigured()) {
            throw new IllegalStateException("Jira 연동이 설정되지 않았습니다. JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_KEY를 확인하세요.");
        }

        TestResultEntity result = testResultRepository.findById(resultId)
                .orElseThrow(() -> new IllegalArgumentException("TestResult not found: " + resultId));

        String projectKey = resolveProjectKey(result);

        JiraService.JiraIssueInfo issue = jiraService.createIssue(
                projectKey, request.summary(), request.description());

        TicketEntity ticket = new TicketEntity();
        ticket.setTestResult(result);
        ticket.setJiraKey(issue.key());
        ticket.setJiraUrl(issue.url());
        ticket.setSummary(request.summary());
        ticket.setStatus("OPEN");

        TicketEntity saved = ticketRepository.save(ticket);
        log.info("Ticket created: {} for result {}", issue.key(), resultId);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TicketDto.TicketResponse> getTicketsByResultId(Long resultId) {
        return ticketRepository.findAllByTestResultIdOrderByCreatedAtDesc(resultId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public void deleteTicket(Long ticketId) {
        ticketRepository.deleteById(ticketId);
    }

    @Override
    @Transactional
    public TicketDto.TicketResponse refreshTicketStatus(Long ticketId) {
        TicketEntity ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));

        if (!jiraService.isConfigured()) {
            throw new IllegalStateException("Jira 연동이 설정되지 않았습니다.");
        }

        String freshStatus = jiraService.getIssueStatus(ticket.getJiraKey());
        ticket.setStatus(freshStatus);
        TicketEntity updated = ticketRepository.save(ticket);
        log.info("Ticket {} status refreshed: {}", ticket.getJiraKey(), freshStatus);
        return toResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public int getTicketCount(Long resultId) {
        return ticketRepository.countByTestResultId(resultId);
    }

    private String resolveProjectKey(TestResultEntity result) {
        Long productId = result.getVersion().getProduct().getId();
        ProductEntity product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        if (product.getJiraProjectKey() != null && !product.getJiraProjectKey().isBlank()) {
            return product.getJiraProjectKey();
        }
        return jiraConfig.getDefaultProjectKey();
    }

    private TicketDto.TicketResponse toResponse(TicketEntity entity) {
        return new TicketDto.TicketResponse(
                entity.getId(),
                entity.getTestResult().getId(),
                entity.getJiraKey(),
                entity.getJiraUrl(),
                entity.getSummary(),
                entity.getStatus(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
