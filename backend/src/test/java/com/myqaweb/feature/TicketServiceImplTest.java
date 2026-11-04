package com.myqaweb.feature;

import com.myqaweb.common.ExternalServiceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketServiceImplTest {
    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private TestResultRepository testResultRepository;

    @Mock
    private JiraService jiraService;

    @Mock
    private NotionService notionService;

    @InjectMocks
    private TicketServiceImpl service;

    private TestResultEntity testResult;
    private TestCaseEntity testCase;
    private TicketEntity jiraTicket;
    private TicketEntity notionTicket;

    @BeforeEach
    void setUp() {
        CompanyEntity company = new CompanyEntity();
        company.setName("Acme");

        ProductEntity product = new ProductEntity();
        product.setId(1L);
        product.setName("Shop");
        product.setCompany(company);

        VersionEntity version = new VersionEntity();
        version.setId(1L);
        version.setName("v1.0");
        version.setProduct(product);

        VersionPhaseEntity phase = new VersionPhaseEntity();
        phase.setId(10L);
        phase.setPhaseName("1차");

        testCase = new TestCaseEntity();
        testCase.setId(42L);
        testCase.setTitle("로그인");
        testCase.setPreconditions("로그인 페이지 진입\n\n  계정 보유  \r\n");
        testCase.setSteps(List.of(
                new TestStep(1, "ID 입력", "입력됨"),
                new TestStep(2, "로그인 클릭", " "),
                new TestStep(3, "새로고침", null)));
        testCase.setExpectedResults(List.of("메인 화면 이동"));
        testCase.setPriority(Priority.HIGH);

        testResult = new TestResultEntity();
        testResult.setId(1L);
        testResult.setVersion(version);
        testResult.setVersionPhase(phase);
        testResult.setTestCase(testCase);
        testResult.setStatus(RunResultStatus.FAIL);
        testResult.setComment("[AI FAIL] #2 FAIL: 버튼 없음\n\n 스크린샷 참조 ");

        jiraTicket = ticket(1L, "TP-1", TicketTracker.JIRA, "OPEN");
        notionTicket = ticket(2L, "notion-page-1", TicketTracker.NOTION, NotionService.STATUS_WAITING);
    }

    private TicketEntity ticket(Long id, String issueKey, TicketTracker tracker, String status) {
        TicketEntity t = new TicketEntity();
        t.setId(id);
        t.setTestResult(testResult);
        t.setIssueKey(issueKey);
        t.setIssueUrl("https://example.com/" + issueKey);
        t.setTracker(tracker);
        t.setSummary("Login fails");
        t.setStatus(status);
        t.setCreatedAt(LocalDateTime.now());
        t.setUpdatedAt(LocalDateTime.now());
        return t;
    }

    private void givenNotionCreateReady() {
        when(notionService.isConfigured()).thenReturn(true);
        when(testResultRepository.findById(1L)).thenReturn(Optional.of(testResult));
        when(notionService.createBugPage(any()))
                .thenReturn(new NotionService.NotionPage("page-123", "https://www.notion.so/page-123"));
        when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private NotionService.BugReport captureBugReport() {
        ArgumentCaptor<NotionService.BugReport> captor = ArgumentCaptor.forClass(NotionService.BugReport.class);
        verify(notionService).createBugPage(captor.capture());
        return captor.getValue();
    }

    // --- createTicket ---

    @Test
    void testCreateTicket_NotionNotConfigured_ThrowsExternalServiceException() {
        when(notionService.isConfigured()).thenReturn(false);
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest("Bug", null, TicketPriority.HIGH, null);

        ExternalServiceException ex = assertThrows(ExternalServiceException.class,
                () -> service.createTicket(1L, request));

        assertTrue(ex.getMessage().contains("Notion 연동이 설정되지 않았습니다"));
        verify(notionService, never()).createBugPage(any());
        verify(ticketRepository, never()).save(any());
        verifyNoInteractions(testResultRepository);
    }

    @Test
    void testCreateTicket_ResultNotFound_ThrowsIllegalArgument() {
        when(notionService.isConfigured()).thenReturn(true);
        when(testResultRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.createTicket(999L,
                new TicketDto.CreateTicketRequest("Bug", null, TicketPriority.HIGH, null)));
        verify(notionService, never()).createBugPage(any());
    }

    @Test
    void testCreateTicket_Success_SavesNotionTicket() {
        givenNotionCreateReady();
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest(
                "Login fails", "재현 메모", TicketPriority.HIGH, "https://atlas.example.com/phases/10");

        TicketDto.TicketResponse response = service.createTicket(1L, request);

        ArgumentCaptor<TicketEntity> captor = ArgumentCaptor.forClass(TicketEntity.class);
        verify(ticketRepository).save(captor.capture());
        TicketEntity saved = captor.getValue();
        assertEquals("page-123", saved.getIssueKey());
        assertEquals("https://www.notion.so/page-123", saved.getIssueUrl());
        assertEquals(TicketTracker.NOTION, saved.getTracker());
        assertEquals("Waiting...", saved.getStatus());
        assertEquals(TicketPriority.HIGH, saved.getPriority());
        assertEquals("Login fails", saved.getSummary());
        assertSame(testResult, saved.getTestResult());

        assertEquals("page-123", response.issueKey());
        assertEquals("https://www.notion.so/page-123", response.issueUrl());
        assertEquals(TicketTracker.NOTION, response.tracker());
        assertEquals(1L, response.testResultId());
        verify(jiraService, never()).isConfigured();
    }

    @Test
    void testCreateTicket_BugReportContent() {
        givenNotionCreateReady();
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest(
                "Login fails", "재현 메모", TicketPriority.HIGHEST, "https://atlas.example.com/phases/10");

        service.createTicket(1L, request);

        NotionService.BugReport report = captureBugReport();
        assertEquals("Login fails", report.title());
        assertEquals(TicketPriority.HIGHEST, report.priority());
        assertEquals(List.of("로그인 페이지 진입", "계정 보유"), report.preconditions());
        assertEquals("https://atlas.example.com/phases/10", report.testDataLink());
        assertEquals(List.of(
                "Company : Acme",
                "Product : Shop",
                "Version : v1.0",
                "Phase : 1차",
                "TC : T42 로그인"), report.testData());
        assertEquals(List.of("ID 입력 → 입력됨", "로그인 클릭", "새로고침"), report.steps());
        assertEquals(List.of("메인 화면 이동"), report.expected());
        assertEquals(List.of("[AI FAIL] #2 FAIL: 버튼 없음", "스크린샷 참조"), report.actual());
        assertEquals("재현 메모", report.memo());
    }

    @Test
    void testCreateTicket_HttpPageUrl_IsLinked() {
        givenNotionCreateReady();

        service.createTicket(1L, new TicketDto.CreateTicketRequest(
                "Bug", null, TicketPriority.LOW, "http://localhost:5173/features/versions/1"));

        assertEquals("http://localhost:5173/features/versions/1", captureBugReport().testDataLink());
    }

    @Test
    void testCreateTicket_NonHttpPageUrl_NotLinked() {
        givenNotionCreateReady();

        service.createTicket(1L, new TicketDto.CreateTicketRequest(
                "Bug", null, TicketPriority.LOW, "javascript:alert(1)"));

        assertNull(captureBugReport().testDataLink());
    }

    @Test
    void testCreateTicket_NullPageUrlAndEmptySources_EmptyLists() {
        testCase.setPreconditions(null);
        testCase.setExpectedResults(null);
        testCase.setSteps(List.of());
        testResult.setComment(null);
        givenNotionCreateReady();

        service.createTicket(1L, new TicketDto.CreateTicketRequest("Bug", null, TicketPriority.LOW, null));

        NotionService.BugReport report = captureBugReport();
        assertNull(report.testDataLink());
        assertEquals(List.of(), report.preconditions());
        assertEquals(List.of(), report.steps());
        assertEquals(List.of(), report.expected());
        assertEquals(List.of(), report.actual());
        assertNull(report.memo());
        assertEquals(5, report.testData().size());
    }

    @Test
    void testCreateTicket_NullRequestPriority_DefaultsToMedium() {
        givenNotionCreateReady();

        service.createTicket(1L, new TicketDto.CreateTicketRequest("Bug", null, null, null));

        assertEquals(TicketPriority.MEDIUM, captureBugReport().priority());
    }

    @Test
    void testCreateTicket_UnknownResultPriority_ConfirmedWithTicketPriority() {
        testResult.setPriority(null);
        givenNotionCreateReady();

        service.createTicket(1L, new TicketDto.CreateTicketRequest("Bug", null, TicketPriority.HIGH, null));

        assertEquals(TicketPriority.HIGH, testResult.getPriority());
        verify(testResultRepository).save(testResult);
    }

    @Test
    void testCreateTicket_KnownResultPriority_Kept() {
        testResult.setPriority(TicketPriority.HIGHEST);
        givenNotionCreateReady();

        service.createTicket(1L, new TicketDto.CreateTicketRequest("Bug", null, TicketPriority.LOW, null));

        assertEquals(TicketPriority.HIGHEST, testResult.getPriority());
        verify(testResultRepository, never()).save(any());
    }

    @Test
    void testCreateTicket_NotionFails_NothingSaved() {
        when(notionService.isConfigured()).thenReturn(true);
        when(testResultRepository.findById(1L)).thenReturn(Optional.of(testResult));
        when(notionService.createBugPage(any()))
                .thenThrow(new ExternalServiceException("Notion 연동 실패: HTTP 404"));

        assertThrows(ExternalServiceException.class, () -> service.createTicket(1L,
                new TicketDto.CreateTicketRequest("Bug", null, TicketPriority.HIGH, null)));

        verify(ticketRepository, never()).save(any());
        verify(testResultRepository, never()).save(any());
        assertNull(testResult.getPriority());
    }

    // --- getTrackerConfig ---

    @Test
    void testGetTrackerConfig_Configured() {
        when(notionService.isConfigured()).thenReturn(true);

        TicketDto.TrackerConfig config = service.getTrackerConfig();

        assertEquals(TicketTracker.NOTION, config.tracker());
        assertTrue(config.configured());
    }

    @Test
    void testGetTrackerConfig_NotConfigured() {
        when(notionService.isConfigured()).thenReturn(false);

        TicketDto.TrackerConfig config = service.getTrackerConfig();

        assertEquals(TicketTracker.NOTION, config.tracker());
        assertFalse(config.configured());
    }

    // --- getTicketsByResultId / delete / count ---

    @Test
    void testGetTicketsByResultId_ReturnsMappedList() {
        when(ticketRepository.findAllByTestResultIdOrderByCreatedAtDesc(1L))
                .thenReturn(List.of(notionTicket, jiraTicket));

        List<TicketDto.TicketResponse> tickets = service.getTicketsByResultId(1L);

        assertEquals(2, tickets.size());
        assertEquals("notion-page-1", tickets.get(0).issueKey());
        assertEquals(TicketTracker.NOTION, tickets.get(0).tracker());
        assertEquals("TP-1", tickets.get(1).issueKey());
        assertEquals(TicketTracker.JIRA, tickets.get(1).tracker());
        assertEquals("https://example.com/TP-1", tickets.get(1).issueUrl());
    }

    @Test
    void testDeleteTicket_Success() {
        service.deleteTicket(1L);

        verify(ticketRepository).deleteById(1L);
    }

    @Test
    void testGetTicketCount_Success() {
        when(ticketRepository.countByTestResultId(1L)).thenReturn(3);

        assertEquals(3, service.getTicketCount(1L));
    }

    // --- refreshTicketStatus ---

    @Test
    void testRefreshTicketStatus_NotionTicket_UsesNotion() {
        when(ticketRepository.findById(2L)).thenReturn(Optional.of(notionTicket));
        when(notionService.isConfigured()).thenReturn(true);
        when(notionService.getStatus("notion-page-1")).thenReturn("In progress");
        when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TicketDto.TicketResponse response = service.refreshTicketStatus(2L);

        assertEquals("In progress", response.status());
        assertNull(notionTicket.getClosedAt());
        verifyNoInteractions(jiraService);
    }

    @Test
    void testRefreshTicketStatus_JiraTicket_UsesJira() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(jiraTicket));
        when(jiraService.isConfigured()).thenReturn(true);
        when(jiraService.getIssueStatus("TP-1")).thenReturn("진행 중");
        when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TicketDto.TicketResponse response = service.refreshTicketStatus(1L);

        assertEquals("진행 중", response.status());
        verify(notionService, never()).getStatus(any());
    }

    @Test
    void testRefreshTicketStatus_NotionDone_SetsClosedAt() {
        assertClosedByNotionStatus("Done");
    }

    @Test
    void testRefreshTicketStatus_NotionClose_SetsClosedAt() {
        assertClosedByNotionStatus("Close");
    }

    private void assertClosedByNotionStatus(String status) {
        when(ticketRepository.findById(2L)).thenReturn(Optional.of(notionTicket));
        when(notionService.isConfigured()).thenReturn(true);
        when(notionService.getStatus("notion-page-1")).thenReturn(status);
        when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refreshTicketStatus(2L);

        assertNotNull(notionTicket.getClosedAt());
        assertEquals(status, notionTicket.getStatus());
    }

    @Test
    void testRefreshTicketStatus_JiraKoreanDone_SetsClosedAt() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(jiraTicket));
        when(jiraService.isConfigured()).thenReturn(true);
        when(jiraService.getIssueStatus("TP-1")).thenReturn("완료");
        when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refreshTicketStatus(1L);

        assertNotNull(jiraTicket.getClosedAt());
    }

    @Test
    void testRefreshTicketStatus_Reopen_IncrementsReopenCount() {
        notionTicket.setStatus("Done");
        notionTicket.setClosedAt(LocalDateTime.now().minusDays(1));
        when(ticketRepository.findById(2L)).thenReturn(Optional.of(notionTicket));
        when(notionService.isConfigured()).thenReturn(true);
        when(notionService.getStatus("notion-page-1")).thenReturn("Waiting...");
        when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refreshTicketStatus(2L);

        assertNull(notionTicket.getClosedAt());
        assertEquals(1, notionTicket.getReopenCount());
    }

    @Test
    void testRefreshTicketStatus_NotionNotConfigured_Throws() {
        when(ticketRepository.findById(2L)).thenReturn(Optional.of(notionTicket));
        when(notionService.isConfigured()).thenReturn(false);

        assertThrows(ExternalServiceException.class, () -> service.refreshTicketStatus(2L));
        verify(ticketRepository, never()).save(any());
    }

    @Test
    void testRefreshTicketStatus_JiraNotConfigured_Throws() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(jiraTicket));
        when(jiraService.isConfigured()).thenReturn(false);

        assertThrows(ExternalServiceException.class, () -> service.refreshTicketStatus(1L));
        verify(ticketRepository, never()).save(any());
    }

    @Test
    void testRefreshTicketStatus_TicketNotFound() {
        when(ticketRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.refreshTicketStatus(999L));
        verifyNoInteractions(notionService, jiraService);
    }

    // --- refreshAllByPhaseId ---

    @Test
    void testRefreshAllByPhaseId_OneFailureDoesNotBlockOthers() {
        when(testResultRepository.findAllByVersionPhaseId(10L)).thenReturn(List.of(testResult));
        when(ticketRepository.findAllByTestResultIdIn(List.of(1L))).thenReturn(List.of(jiraTicket, notionTicket));
        when(jiraService.isConfigured()).thenReturn(true);
        when(jiraService.getIssueStatus("TP-1")).thenThrow(new RuntimeException("Jira down"));
        when(notionService.isConfigured()).thenReturn(true);
        when(notionService.getStatus("notion-page-1")).thenReturn("Done");

        int refreshed = service.refreshAllByPhaseId(10L);

        assertEquals(1, refreshed);
        verify(ticketRepository).save(notionTicket);
        verify(ticketRepository, never()).save(jiraTicket);
        assertNotNull(notionTicket.getClosedAt());
        assertEquals("OPEN", jiraTicket.getStatus());
    }

    @Test
    void testRefreshAllByPhaseId_NoResults_ReturnsZero() {
        when(testResultRepository.findAllByVersionPhaseId(10L)).thenReturn(List.of());

        assertEquals(0, service.refreshAllByPhaseId(10L));
        verify(ticketRepository, never()).findAllByTestResultIdIn(any());
    }
}
