package com.myqaweb.feature;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.ExternalServiceException;
import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TicketController.class)
@Import({GlobalExceptionHandler.class, com.myqaweb.config.JacksonCompatConfig.class})
@AutoConfigureMockMvc(addFilters = false)
class TicketControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TicketService ticketService;

    @Autowired
    private ObjectMapper objectMapper;

    private TicketDto.TicketResponse ticketResponse;

    @BeforeEach
    void setUp() {
        ticketResponse = new TicketDto.TicketResponse(
                1L, 1L, "page-1", "https://www.notion.so/page-1", TicketTracker.NOTION,
                "Login fails on invalid input", "Waiting...",
                LocalDateTime.now(), LocalDateTime.now()
        );
    }

    @Test
    void testGetTrackerConfig_Success() throws Exception {
        when(ticketService.getTrackerConfig()).thenReturn(new TicketDto.TrackerConfig(TicketTracker.NOTION, false));

        mockMvc.perform(get("/api/tickets/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.tracker", is("NOTION")))
                .andExpect(jsonPath("$.data.configured", is(false)));
    }

    @Test
    void testCreateTicket_Success() throws Exception {
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest(
                "Login fails on invalid input", "Steps to reproduce...", TicketPriority.HIGH,
                "https://atlas.example.com/phases/1"
        );

        when(ticketService.createTicket(eq(1L), any())).thenReturn(ticketResponse);

        mockMvc.perform(post("/api/versions/{versionId}/results/{resultId}/tickets", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.issueKey", is("page-1")))
                .andExpect(jsonPath("$.data.issueUrl", is("https://www.notion.so/page-1")))
                .andExpect(jsonPath("$.data.tracker", is("NOTION")))
                .andExpect(jsonPath("$.data.summary", is("Login fails on invalid input")))
                .andExpect(jsonPath("$.data.status", is("Waiting...")));

        ArgumentCaptor<TicketDto.CreateTicketRequest> captor = ArgumentCaptor.forClass(TicketDto.CreateTicketRequest.class);
        verify(ticketService).createTicket(eq(1L), captor.capture());
        assertEquals(TicketPriority.HIGH, captor.getValue().priority());
        assertEquals("https://atlas.example.com/phases/1", captor.getValue().pageUrl());
    }

    @Test
    void testCreateTicket_ExternalServiceFailure_Returns502() throws Exception {
        when(ticketService.createTicket(eq(1L), any()))
                .thenThrow(new ExternalServiceException("Notion 연동 실패: HTTP 404 — Could not find database"));

        mockMvc.perform(post("/api/versions/{versionId}/results/{resultId}/tickets", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"summary\":\"Bug\",\"priority\":\"HIGH\"}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.message", is("Notion 연동 실패: HTTP 404 — Could not find database")));
    }

    @Test
    void testCreateTicket_ValidationFails_MissingSummary() throws Exception {
        TicketDto.CreateTicketRequest request = new TicketDto.CreateTicketRequest("", null, null, null);

        mockMvc.perform(post("/api/versions/{versionId}/results/{resultId}/tickets", 1L, 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(ticketService, never()).createTicket(any(), any());
    }

    @Test
    void testGetTickets_Success() throws Exception {
        TicketDto.TicketResponse ticket2 = new TicketDto.TicketResponse(
                2L, 1L, "TP-2", "https://jira.example.com/browse/TP-2", TicketTracker.JIRA,
                "Another bug", "IN_PROGRESS",
                LocalDateTime.now(), LocalDateTime.now()
        );

        when(ticketService.getTicketsByResultId(1L)).thenReturn(List.of(ticketResponse, ticket2));

        mockMvc.perform(get("/api/versions/{versionId}/results/{resultId}/tickets", 1L, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].issueKey", is("page-1")))
                .andExpect(jsonPath("$.data[0].tracker", is("NOTION")))
                .andExpect(jsonPath("$.data[1].issueKey", is("TP-2")))
                .andExpect(jsonPath("$.data[1].tracker", is("JIRA")));

        verify(ticketService).getTicketsByResultId(1L);
    }

    @Test
    void testDeleteTicket_Success() throws Exception {
        doNothing().when(ticketService).deleteTicket(1L);

        mockMvc.perform(delete("/api/versions/{versionId}/results/{resultId}/tickets/{ticketId}", 1L, 1L, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.message", is("Ticket deleted")));

        verify(ticketService).deleteTicket(1L);
    }

    @Test
    void testRefreshTicket_Success() throws Exception {
        TicketDto.TicketResponse refreshed = new TicketDto.TicketResponse(
                1L, 1L, "page-1", "https://www.notion.so/page-1", TicketTracker.NOTION,
                "Login fails on invalid input", "Done",
                LocalDateTime.now(), LocalDateTime.now()
        );

        when(ticketService.refreshTicketStatus(1L)).thenReturn(refreshed);

        mockMvc.perform(post("/api/versions/{versionId}/results/{resultId}/tickets/{ticketId}/refresh", 1L, 1L, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.status", is("Done")));

        verify(ticketService).refreshTicketStatus(1L);
    }

    @Test
    void testRefreshTicket_ExternalServiceFailure_Returns502() throws Exception {
        when(ticketService.refreshTicketStatus(1L))
                .thenThrow(new ExternalServiceException("Notion 연동이 설정되지 않았습니다."));

        mockMvc.perform(post("/api/versions/{versionId}/results/{resultId}/tickets/{ticketId}/refresh", 1L, 1L, 1L))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.message", containsString("Notion")));
    }
}
