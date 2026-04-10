package com.myqaweb.senior;

import jakarta.validation.constraints.NotBlank;

public class ChatDto {

    public record ChatRequest(
            @NotBlank(message = "Message is required")
            String message,
            FaqContext faqContext,
            Long sessionId
    ) {}

    public record FaqContext(String title, String content) {}
}
