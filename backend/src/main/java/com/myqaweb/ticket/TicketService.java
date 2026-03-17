package com.myqaweb.ticket;

import org.springframework.stereotype.Service;

@Service
public class TicketService {
    public String review(String ticketContent) {
        // TODO: use Spring AI ChatClient to review the ticket
        return "Ticket review placeholder for: " + ticketContent;
    }
}
