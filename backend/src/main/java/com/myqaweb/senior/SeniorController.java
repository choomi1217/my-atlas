package com.myqaweb.senior;

import com.myqaweb.common.ApiResponse;
import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/senior")
@RequiredArgsConstructor
public class SeniorController {

    private final SeniorService seniorService;

    // --- Chat (SSE Streaming) ---

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@Valid @RequestBody ChatDto.ChatRequest request) {
        return seniorService.chat(request);
    }

    // --- Curated FAQ (KB-based) ---

    @GetMapping("/faq")
    public ResponseEntity<ApiResponse<List<KnowledgeBaseDto.KbResponse>>> listFaqs() {
        List<KnowledgeBaseDto.KbResponse> faqs = seniorService.getCuratedFaqs();
        return ResponseEntity.ok(ApiResponse.ok(faqs));
    }
}
