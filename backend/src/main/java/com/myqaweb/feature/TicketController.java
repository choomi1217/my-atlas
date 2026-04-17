package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Ticket (Jira issue) endpoints.
 */
@RestController
@RequestMapping("/api")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @PostMapping("/versions/{versionId}/results/{resultId}/tickets")
    public ResponseEntity<ApiResponse<TicketDto.TicketResponse>> createTicket(
            @PathVariable Long versionId,
            @PathVariable Long resultId,
            @Valid @RequestBody TicketDto.CreateTicketRequest request) {
        TicketDto.TicketResponse ticket = ticketService.createTicket(resultId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ApiResponse<>(true, "Ticket created", ticket));
    }

    @GetMapping("/versions/{versionId}/results/{resultId}/tickets")
    public ResponseEntity<ApiResponse<List<TicketDto.TicketResponse>>> getTickets(
            @PathVariable Long versionId,
            @PathVariable Long resultId) {
        List<TicketDto.TicketResponse> tickets = ticketService.getTicketsByResultId(resultId);
        return ResponseEntity.ok(new ApiResponse<>(true, "Tickets retrieved", tickets));
    }

    @DeleteMapping("/versions/{versionId}/results/{resultId}/tickets/{ticketId}")
    public ResponseEntity<ApiResponse<Void>> deleteTicket(
            @PathVariable Long versionId,
            @PathVariable Long resultId,
            @PathVariable Long ticketId) {
        ticketService.deleteTicket(ticketId);
        return ResponseEntity.ok(new ApiResponse<>(true, "Ticket deleted", null));
    }

    @PostMapping("/versions/{versionId}/results/{resultId}/tickets/{ticketId}/refresh")
    public ResponseEntity<ApiResponse<TicketDto.TicketResponse>> refreshTicket(
            @PathVariable Long versionId,
            @PathVariable Long resultId,
            @PathVariable Long ticketId) {
        TicketDto.TicketResponse ticket = ticketService.refreshTicketStatus(ticketId);
        return ResponseEntity.ok(new ApiResponse<>(true, "Ticket status refreshed", ticket));
    }

    @PostMapping("/versions/{versionId}/phases/{phaseId}/tickets/refresh-all")
    public ResponseEntity<ApiResponse<Integer>> refreshAllTickets(
            @PathVariable Long versionId,
            @PathVariable Long phaseId) {
        int count = ticketService.refreshAllByPhaseId(phaseId);
        return ResponseEntity.ok(new ApiResponse<>(true, count + "개 티켓 상태 갱신 완료", count));
    }
}
