package com.myqaweb.convention;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conventions")
@RequiredArgsConstructor
public class ConventionController {

    private final ConventionService conventionService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ConventionDto.ConventionResponse>>> list() {
        List<ConventionDto.ConventionResponse> items = conventionService.findAll();
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ConventionDto.ConventionResponse>> getById(@PathVariable Long id) {
        return conventionService.findById(id)
                .map(conv -> ResponseEntity.ok(ApiResponse.ok(conv)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Convention not found")));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ConventionDto.ConventionResponse>> create(
            @Valid @RequestBody ConventionDto.ConventionRequest request) {
        ConventionDto.ConventionResponse created = conventionService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Convention created", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ConventionDto.ConventionResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody ConventionDto.ConventionRequest request) {
        ConventionDto.ConventionResponse updated = conventionService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Convention updated", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        conventionService.delete(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Convention deleted", null));
    }
}
