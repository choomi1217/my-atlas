package com.myqaweb.senior;

import com.myqaweb.common.ApiResponse;
import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
    private final ChatSessionService chatSessionService;

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

    // --- Chat Sessions ---

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<ChatSessionDto.SessionResponse>>> listSessions() {
        return ResponseEntity.ok(ApiResponse.ok(chatSessionService.findAllSessions()));
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<ApiResponse<ChatSessionDto.SessionDetailResponse>> getSession(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(chatSessionService.findSessionById(id)));
    }

    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<ChatSessionDto.SessionResponse>> createSession() {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(chatSessionService.createSession()));
    }

    @PatchMapping("/sessions/{id}")
    public ResponseEntity<ApiResponse<ChatSessionDto.SessionResponse>> updateSessionTitle(
            @PathVariable Long id,
            @Valid @RequestBody ChatSessionDto.UpdateTitleRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(chatSessionService.updateSessionTitle(id, request.title())));
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSession(@PathVariable Long id) {
        chatSessionService.deleteSession(id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
