package com.myqaweb.feature;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
    private JiraConfig jiraConfig;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private VersionRepository versionRepository;

    @InjectMocks
    private TicketServiceImpl service;

    private TestResultEntity testResult;
    private TicketEntity ticket;
    private ProductEntity product;

    @BeforeEach
    void setUp() {
        product = new ProductEntity();
        product.setId(1L);
        product.setName("Test Product");
        product.setJiraProjectKey("TP");

        VersionEntity version = new VersionEntity();
        version.setId(1L);
        version.setProduct(product);

        testResult = new TestResultEntity();
        testResult.setId(1L);
        testResult.setVersion(version);
        testResult.setStatus(RunResultStatus.FAIL);

        ticket = new TicketEntity();
        ticket.setId(1L);
        ticket.setTestResult(testResult);
        ticket.setJiraKey("TP-1");
        ticket.setJiraUrl("https://jira.example.com/browse/TP-1");
        ticket.setSummary("Login fails on invalid input");
        ticket.setStatus("OPEN");
        ticket.setCreatedAt(LocalDateTime.now());
        ticket.setUpdatedAt(LocalDateTime.now());
    }

    @Test
    void testCreateTicket_JiraConfigured_Success() {
        // Given
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest(
                "Login fails on invalid input", "Steps to reproduce..."
        );

        when(jiraService.isConfigured()).thenReturn(true);
        when(testResultRepository.findById(1L)).thenReturn(Optional.of(testResult));
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(jiraService.createIssue("TP", "Login fails on invalid input", "Steps to reproduce..."))
                .thenReturn(new JiraService.JiraIssueInfo("TP-1", "https://jira.example.com/browse/TP-1"));
        when(ticketRepository.save(any())).thenReturn(ticket);

        // When
        TicketDto.TicketResponse response = service.createTicket(1L, request);

        // Then
        assertNotNull(response);
        assertEquals("TP-1", response.jiraKey());
        assertEquals("https://jira.example.com/browse/TP-1", response.jiraUrl());
        assertEquals("Login fails on invalid input", response.summary());
        assertEquals("OPEN", response.status());
        verify(jiraService).isConfigured();
        verify(jiraService).createIssue("TP", "Login fails on invalid input", "Steps to reproduce...");
        verify(ticketRepository).save(any());
    }

    @Test
    void testCreateTicket_JiraNotConfigured_ThrowsException() {
        // Given
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest(
                "Bug summary", null
        );

        when(jiraService.isConfigured()).thenReturn(false);

        // When & Then
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> service.createTicket(1L, request));
        assertTrue(exception.getMessage().contains("Jira 연동이 설정되지 않았습니다"));
        verify(jiraService).isConfigured();
        verify(ticketRepository, never()).save(any());
    }

    @Test
    void testCreateTicket_UsesDefaultProjectKey_WhenProductHasNoKey() {
        // Given
        ProductEntity productWithoutKey = new ProductEntity();
        productWithoutKey.setId(2L);
        productWithoutKey.setName("No Key Product");
        productWithoutKey.setJiraProjectKey(null);

        VersionEntity version = new VersionEntity();
        version.setId(1L);
        version.setProduct(productWithoutKey);

        TestResultEntity resultWithoutKey = new TestResultEntity();
        resultWithoutKey.setId(2L);
        resultWithoutKey.setVersion(version);

        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest("Bug", null);

        when(jiraService.isConfigured()).thenReturn(true);
        when(testResultRepository.findById(2L)).thenReturn(Optional.of(resultWithoutKey));
        when(productRepository.findById(2L)).thenReturn(Optional.of(productWithoutKey));
        when(jiraConfig.getDefaultProjectKey()).thenReturn("DEFAULT");
        when(jiraService.createIssue(eq("DEFAULT"), any(), any()))
                .thenReturn(new JiraService.JiraIssueInfo("DEFAULT-1", "https://jira.example.com/browse/DEFAULT-1"));
        when(ticketRepository.save(any())).thenReturn(ticket);

        // When
        service.createTicket(2L, request);

        // Then
        verify(jiraConfig).getDefaultProjectKey();
        verify(jiraService).createIssue(eq("DEFAULT"), any(), any());
    }

    @Test
    void testGetTicketsByResultId_ReturnsSortedList() {
        // Given
        TicketEntity ticket2 = new TicketEntity();
        ticket2.setId(2L);
        ticket2.setTestResult(testResult);
        ticket2.setJiraKey("TP-2");
        ticket2.setJiraUrl("https://jira.example.com/browse/TP-2");
        ticket2.setSummary("Another bug");
        ticket2.setStatus("IN_PROGRESS");
        ticket2.setCreatedAt(LocalDateTime.now());
        ticket2.setUpdatedAt(LocalDateTime.now());

        when(ticketRepository.findAllByTestResultIdOrderByCreatedAtDesc(1L))
                .thenReturn(List.of(ticket2, ticket));

        // When
        List<TicketDto.TicketResponse> tickets = service.getTicketsByResultId(1L);

        // Then
        assertEquals(2, tickets.size());
        assertEquals("TP-2", tickets.get(0).jiraKey());
        assertEquals("TP-1", tickets.get(1).jiraKey());
        verify(ticketRepository).findAllByTestResultIdOrderByCreatedAtDesc(1L);
    }

    @Test
    void testRefreshTicketStatus_Success() {
        // Given
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(jiraService.isConfigured()).thenReturn(true);
        when(jiraService.getIssueStatus("TP-1")).thenReturn("완료");

        TicketEntity updatedTicket = new TicketEntity();
        updatedTicket.setId(1L);
        updatedTicket.setTestResult(testResult);
        updatedTicket.setJiraKey("TP-1");
        updatedTicket.setJiraUrl("https://jira.example.com/browse/TP-1");
        updatedTicket.setSummary("Login fails on invalid input");
        updatedTicket.setStatus("완료");
        updatedTicket.setCreatedAt(ticket.getCreatedAt());
        updatedTicket.setUpdatedAt(LocalDateTime.now());

        when(ticketRepository.save(any())).thenReturn(updatedTicket);

        // When
        TicketDto.TicketResponse response = service.refreshTicketStatus(1L);

        // Then
        assertNotNull(response);
        assertEquals("완료", response.status());
        verify(jiraService).getIssueStatus("TP-1");
        verify(ticketRepository).save(any());
    }

    @Test
    void testRefreshTicketStatus_JiraNotConfigured_ThrowsException() {
        // Given
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket));
        when(jiraService.isConfigured()).thenReturn(false);

        // When & Then
        assertThrows(IllegalStateException.class, () -> service.refreshTicketStatus(1L));
        verify(ticketRepository, never()).save(any());
    }

    @Test
    void testRefreshTicketStatus_TicketNotFound() {
        // Given
        when(ticketRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(IllegalArgumentException.class, () -> service.refreshTicketStatus(999L));
        verify(jiraService, never()).getIssueStatus(any());
    }

    @Test
    void testDeleteTicket_Success() {
        // When
        service.deleteTicket(1L);

        // Then
        verify(ticketRepository).deleteById(1L);
    }

    @Test
    void testGetTicketCount_Success() {
        // Given
        when(ticketRepository.countByTestResultId(1L)).thenReturn(3);

        // When
        int count = service.getTicketCount(1L);

        // Then
        assertEquals(3, count);
        verify(ticketRepository).countByTestResultId(1L);
    }
}
