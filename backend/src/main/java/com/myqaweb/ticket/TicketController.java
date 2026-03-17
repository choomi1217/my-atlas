package com.myqaweb.ticket;

import com.myqaweb.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ticket")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @PostMapping("/review")
    public ApiResponse<String> review(@RequestBody ReviewRequest request) {
        String result = ticketService.review(request.ticketContent());
        return ApiResponse.ok(result);
    }

    record ReviewRequest(String ticketContent) {}
}
