package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Segment operations.
 */
@RestController
@RequestMapping("/api/segments")
@RequiredArgsConstructor
public class SegmentController {
    private final SegmentService segmentService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SegmentDto.SegmentResponse>>> getByProductId(
            @RequestParam Long productId) {
        List<SegmentDto.SegmentResponse> segments = segmentService.findByProductId(productId);
        return ResponseEntity.ok(ApiResponse.ok(segments));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SegmentDto.SegmentResponse>> create(
            @Valid @RequestBody SegmentDto.SegmentRequest request) {
        SegmentDto.SegmentResponse response = segmentService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<SegmentDto.SegmentResponse>> update(
            @PathVariable Long id,
            @RequestBody SegmentDto.SegmentRequest request) {
        SegmentDto.SegmentResponse response = segmentService.update(id, request.name());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        segmentService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
