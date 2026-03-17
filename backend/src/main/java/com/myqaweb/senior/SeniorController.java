package com.myqaweb.senior;

import com.myqaweb.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/senior")
public class SeniorController {

    private final SeniorService seniorService;

    public SeniorController(SeniorService seniorService) {
        this.seniorService = seniorService;
    }

    /** POST /api/senior/chat  { "message": "..." } */
    @PostMapping("/chat")
    public ApiResponse<String> chat(@RequestBody ChatRequest request) {
        String reply = seniorService.chat(request.message());
        return ApiResponse.ok(reply);
    }

    record ChatRequest(String message) {}
}
