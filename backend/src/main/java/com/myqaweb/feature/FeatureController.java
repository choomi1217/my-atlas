package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Feature endpoints.
 */
@RestController
@RequestMapping("/api/features")
@RequiredArgsConstructor
public class FeatureController {
    private final FeatureService featureService;

    /**
     * GET /api/features?productId={id} - List features by product.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<FeatureDto.FeatureResponse>>> listByProduct(
            @RequestParam Long productId) {
        List<FeatureDto.FeatureResponse> features = featureService.findByProductId(productId);
        return ResponseEntity.ok(ApiResponse.ok(features));
    }

    /**
     * POST /api/features - Create a new feature with embedding.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<FeatureDto.FeatureResponse>> create(
            @Valid @RequestBody FeatureDto.FeatureRequest request) {
        FeatureDto.FeatureResponse feature = featureService.saveWithEmbedding(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Feature created successfully", feature));
    }

    /**
     * PUT /api/features/{id} - Update a feature and regenerate embedding.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<FeatureDto.FeatureResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody FeatureDto.FeatureRequest request) {
        FeatureDto.FeatureResponse feature = featureService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Feature updated successfully", feature));
    }

    /**
     * DELETE /api/features/{id} - Delete a feature.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        featureService.delete(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Feature deleted successfully", null));
    }

    /**
     * POST /api/features/search - Search similar features by query.
     */
    @PostMapping("/search")
    public ResponseEntity<ApiResponse<List<FeatureDto.FeatureResponse>>> search(
            @Valid @RequestBody FeatureDto.FeatureSearchQuery query) {
        List<FeatureDto.FeatureResponse> results = featureService.searchSimilar(query.query(), query.topK());
        return ResponseEntity.ok(ApiResponse.ok(results));
    }
}
