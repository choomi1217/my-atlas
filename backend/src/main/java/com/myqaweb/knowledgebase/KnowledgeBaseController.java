package com.myqaweb.knowledgebase;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kb")
@RequiredArgsConstructor
public class KnowledgeBaseController {

    private final KnowledgeBaseService knowledgeBaseService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<KnowledgeBaseDto.KbResponse>>> list() {
        List<KnowledgeBaseDto.KbResponse> items = knowledgeBaseService.findAll();
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<KnowledgeBaseDto.KbResponse>> getById(@PathVariable Long id) {
        return knowledgeBaseService.findById(id)
                .map(kb -> ResponseEntity.ok(ApiResponse.ok(kb)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Knowledge Base entry not found")));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<KnowledgeBaseDto.KbResponse>> create(
            @Valid @RequestBody KnowledgeBaseDto.KbRequest request) {
        KnowledgeBaseDto.KbResponse created = knowledgeBaseService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Knowledge Base entry created", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<KnowledgeBaseDto.KbResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody KnowledgeBaseDto.KbRequest request) {
        KnowledgeBaseDto.KbResponse updated = knowledgeBaseService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Knowledge Base entry updated", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        knowledgeBaseService.delete(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Knowledge Base entry deleted", null));
    }
}
