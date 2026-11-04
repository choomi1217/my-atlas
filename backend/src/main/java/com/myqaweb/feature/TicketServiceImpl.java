package com.myqaweb.feature;

import com.myqaweb.common.ExternalServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

/**
 * Ticket service implementation — publishes new tickets to Notion and refreshes status per tracker.
 */
@Service
public class TicketServiceImpl implements TicketService {

    private static final Logger log = LoggerFactory.getLogger(TicketServiceImpl.class);

    private static final String NOTION_NOT_CONFIGURED =
            "Notion 연동이 설정되지 않았습니다. NOTION_API_KEY, NOTION_BUG_DATABASE_ID를 확인하세요.";
    private static final String JIRA_NOT_CONFIGURED = "Jira 연동이 설정되지 않았습니다.";

    private final TicketRepository ticketRepository;
    private final TestResultRepository testResultRepository;
    private final JiraService jiraService;
    private final NotionService notionService;

    public TicketServiceImpl(TicketRepository ticketRepository,
                             TestResultRepository testResultRepository,
                             JiraService jiraService,
                             NotionService notionService) {
        this.ticketRepository = ticketRepository;
        this.testResultRepository = testResultRepository;
        this.jiraService = jiraService;
        this.notionService = notionService;
    }

    @Override
    @Transactional
    public TicketDto.TicketResponse createTicket(Long resultId, TicketDto.CreateTicketRequest request) {
        if (!notionService.isConfigured()) {
            throw new ExternalServiceException(NOTION_NOT_CONFIGURED);
        }

        TestResultEntity result = testResultRepository.findById(resultId)
                .orElseThrow(() -> new IllegalArgumentException("TestResult not found: " + resultId));

        TicketPriority priority = request.priority() != null ? request.priority() : TicketPriority.MEDIUM;

        NotionService.NotionPage page = notionService.createBugPage(toBugReport(result, request, priority));

        TicketEntity ticket = new TicketEntity();
        ticket.setTestResult(result);
        ticket.setIssueKey(page.id());
        ticket.setIssueUrl(page.url());
        ticket.setTracker(TicketTracker.NOTION);
        ticket.setSummary(request.summary());
        ticket.setStatus(NotionService.STATUS_WAITING);
        ticket.setPriority(priority);

        TicketEntity saved = ticketRepository.save(ticket);
        if (result.getPriority() == null) {
            result.setPriority(priority);  // 티켓 발행 = 사람이 Priority 확정
            testResultRepository.save(result);
        }
        log.info("Ticket created: {} for result {}", page.id(), resultId);
        return toResponse(saved);
    }

    @Override
    public TicketDto.TrackerConfig getTrackerConfig() {
        return new TicketDto.TrackerConfig(TicketTracker.NOTION, notionService.isConfigured());
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

        String freshStatus = fetchStatus(ticket);
        String oldStatus = ticket.getStatus();

        // Detect closure: open → done
        if (isDoneStatus(freshStatus) && ticket.getClosedAt() == null) {
            ticket.setClosedAt(java.time.LocalDateTime.now());
        }
        // Detect reopen: done → open
        if (isDoneStatus(oldStatus) && !isDoneStatus(freshStatus)) {
            ticket.setReopenCount(ticket.getReopenCount() + 1);
            ticket.setClosedAt(null);
        }

        ticket.setStatus(freshStatus);
        TicketEntity updated = ticketRepository.save(ticket);
        log.info("Ticket {} status refreshed: {} → {}", ticket.getIssueKey(), oldStatus, freshStatus);
        return toResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public int getTicketCount(Long resultId) {
        return ticketRepository.countByTestResultId(resultId);
    }

    @Override
    @Transactional
    public int refreshAllByPhaseId(Long phaseId) {
        List<Long> resultIds = testResultRepository.findAllByVersionPhaseId(phaseId)
                .stream().map(TestResultEntity::getId).toList();

        if (resultIds.isEmpty()) return 0;

        List<TicketEntity> tickets = ticketRepository.findAllByTestResultIdIn(resultIds);
        int refreshed = 0;

        for (TicketEntity ticket : tickets) {
            try {
                String freshStatus = fetchStatus(ticket);
                String oldStatus = ticket.getStatus();

                if (isDoneStatus(freshStatus) && ticket.getClosedAt() == null) {
                    ticket.setClosedAt(java.time.LocalDateTime.now());
                }
                if (isDoneStatus(oldStatus) && !isDoneStatus(freshStatus)) {
                    ticket.setReopenCount(ticket.getReopenCount() + 1);
                    ticket.setClosedAt(null);
                }

                ticket.setStatus(freshStatus);
                ticketRepository.save(ticket);
                refreshed++;
            } catch (Exception e) {
                log.warn("Failed to refresh ticket {}: {}", ticket.getIssueKey(), e.getMessage());
            }
        }

        log.info("Refreshed {}/{} tickets for phase {}", refreshed, tickets.size(), phaseId);
        return refreshed;
    }

    private String fetchStatus(TicketEntity ticket) {
        if (ticket.getTracker() == TicketTracker.NOTION) {
            if (!notionService.isConfigured()) {
                throw new ExternalServiceException(NOTION_NOT_CONFIGURED);
            }
            return notionService.getStatus(ticket.getIssueKey());
        }
        if (!jiraService.isConfigured()) {
            throw new ExternalServiceException(JIRA_NOT_CONFIGURED);
        }
        return jiraService.getIssueStatus(ticket.getIssueKey());
    }

    private NotionService.BugReport toBugReport(TestResultEntity result, TicketDto.CreateTicketRequest request,
                                                TicketPriority priority) {
        TestCaseEntity testCase = result.getTestCase();
        ProductEntity product = result.getVersion().getProduct();

        String pageUrl = request.pageUrl();
        String testDataLink = pageUrl != null && (pageUrl.startsWith("http://") || pageUrl.startsWith("https://"))
                ? pageUrl : null;

        List<String> testData = List.of(
                "Company : " + product.getCompany().getName(),
                "Product : " + product.getName(),
                "Version : " + result.getVersion().getName(),
                "Phase : " + result.getVersionPhase().getPhaseName(),
                "TC : T" + testCase.getId() + " " + testCase.getTitle());

        List<String> steps = testCase.getSteps().stream()
                .map(s -> s.expected() != null && !s.expected().isBlank()
                        ? s.action() + " → " + s.expected() : s.action())
                .toList();

        List<String> expected = testCase.getExpectedResults() != null ? testCase.getExpectedResults() : List.of();

        return new NotionService.BugReport(
                request.summary(), priority,
                lines(testCase.getPreconditions()), testDataLink, testData,
                steps, expected, lines(result.getComment()), request.description());
    }

    private List<String> lines(String text) {
        if (text == null) return List.of();
        return Arrays.stream(text.split("\\R")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private boolean isDoneStatus(String status) {
        if (status == null) return false;
        String upper = status.toUpperCase();
        return upper.equals("DONE") || upper.equals("CLOSED") || upper.equals("RESOLVED")
                || upper.equals("CLOSE") || upper.equals("완료");
    }

    private TicketDto.TicketResponse toResponse(TicketEntity entity) {
        return new TicketDto.TicketResponse(
                entity.getId(),
                entity.getTestResult().getId(),
                entity.getIssueKey(),
                entity.getIssueUrl(),
                entity.getTracker(),
                entity.getSummary(),
                entity.getStatus(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
