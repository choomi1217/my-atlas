package com.myqaweb.senior;

import com.myqaweb.common.ApiResponse;
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

    // --- Chat (SSE Streaming) ---

    /**
     * POST /api/senior/chat — streams AI response via SSE.
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@Valid @RequestBody ChatDto.ChatRequest request) {
        return seniorService.chat(request);
    }

    // --- FAQ CRUD ---

    @GetMapping("/faq")
    public ResponseEntity<ApiResponse<List<FaqDto.FaqResponse>>> listFaqs() {
        List<FaqDto.FaqResponse> faqs = seniorService.findAllFaqs();
        return ResponseEntity.ok(ApiResponse.ok(faqs));
    }

    @GetMapping("/faq/{id}")
    public ResponseEntity<ApiResponse<FaqDto.FaqResponse>> getFaq(@PathVariable Long id) {
        return seniorService.findFaqById(id)
                .map(faq -> ResponseEntity.ok(ApiResponse.ok(faq)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("FAQ not found")));
    }

    @PostMapping("/faq")
    public ResponseEntity<ApiResponse<FaqDto.FaqResponse>> createFaq(
            @Valid @RequestBody FaqDto.FaqRequest request) {
        FaqDto.FaqResponse created = seniorService.createFaq(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("FAQ created", created));
    }

    @PutMapping("/faq/{id}")
    public ResponseEntity<ApiResponse<FaqDto.FaqResponse>> updateFaq(
            @PathVariable Long id,
            @Valid @RequestBody FaqDto.FaqRequest request) {
        FaqDto.FaqResponse updated = seniorService.updateFaq(id, request);
        return ResponseEntity.ok(ApiResponse.ok("FAQ updated", updated));
    }

    @DeleteMapping("/faq/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteFaq(@PathVariable Long id) {
        seniorService.deleteFaq(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "FAQ deleted", null));
    }
}
