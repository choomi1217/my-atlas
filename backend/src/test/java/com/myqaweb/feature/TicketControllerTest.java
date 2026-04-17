package com.myqaweb.feature;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TicketController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class TicketControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TicketService ticketService;

    @Autowired
    private ObjectMapper objectMapper;

    private TicketDto.TicketResponse ticketResponse;

    @BeforeEach
    void setUp() {
        ticketResponse = new TicketDto.TicketResponse(
                1L, 1L, "TP-1", "https://jira.example.com/browse/TP-1",
                "Login fails on invalid input", "OPEN",
                LocalDateTime.now(), LocalDateTime.now()
        );
    }

    @Test
    void testCreateTicket_Success() throws Exception {
        // Given
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest(
                "Login fails on invalid input", "Steps to reproduce...", null
        );

        when(ticketService.createTicket(eq(1L), any())).thenReturn(ticketResponse);

        // When & Then
        mockMvc.perform(post("/api/versions/{versionId}/results/{resultId}/tickets", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.jiraKey", is("TP-1")))
                .andExpect(jsonPath("$.data.summary", is("Login fails on invalid input")))
                .andExpect(jsonPath("$.data.status", is("OPEN")));

        verify(ticketService).createTicket(eq(1L), any());
    }

    @Test
    void testCreateTicket_ValidationFails_MissingSummary() throws Exception {
        // Given - empty summary
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest("", null, null);

        // When & Then
        mockMvc.perform(post("/api/versions/{versionId}/results/{resultId}/tickets", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(ticketService, never()).createTicket(any(), any());
    }

    @Test
    void testGetTickets_Success() throws Exception {
        // Given
        TicketDto.TicketResponse ticket2 = new TicketDto.TicketResponse(
                2L, 1L, "TP-2", "https://jira.example.com/browse/TP-2",
                "Another bug", "IN_PROGRESS",
                LocalDateTime.now(), LocalDateTime.now()
        );

        when(ticketService.getTicketsByResultId(1L)).thenReturn(List.of(ticketResponse, ticket2));

        // When & Then
        mockMvc.perform(get("/api/versions/{versionId}/results/{resultId}/tickets", 1L, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].jiraKey", is("TP-1")))
                .andExpect(jsonPath("$.data[1].jiraKey", is("TP-2")));

        verify(ticketService).getTicketsByResultId(1L);
    }

    @Test
    void testDeleteTicket_Success() throws Exception {
        // Given
        doNothing().when(ticketService).deleteTicket(1L);

        // When & Then
        mockMvc.perform(delete("/api/versions/{versionId}/results/{resultId}/tickets/{ticketId}", 1L, 1L, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.message", is("Ticket deleted")));

        verify(ticketService).deleteTicket(1L);
    }

    @Test
    void testRefreshTicket_Success() throws Exception {
        // Given
        TicketDto.TicketResponse refreshed = new TicketDto.TicketResponse(
                1L, 1L, "TP-1", "https://jira.example.com/browse/TP-1",
                "Login fails on invalid input", "완료",
                LocalDateTime.now(), LocalDateTime.now()
        );

        when(ticketService.refreshTicketStatus(1L)).thenReturn(refreshed);

        // When & Then
        mockMvc.perform(post("/api/versions/{versionId}/results/{resultId}/tickets/{ticketId}/refresh", 1L, 1L, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.status", is("완료")));

        verify(ticketService).refreshTicketStatus(1L);
    }
}
