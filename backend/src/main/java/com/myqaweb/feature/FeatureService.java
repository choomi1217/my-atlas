package com.myqaweb.feature;

import java.util.List;
import java.util.Optional;

/**
 * Service interface for Feature operations.
 */
public interface FeatureService {
    /**
     * Get all features by product ID.
     *
     * @param productId the product ID
     * @return list of features
     */
    List<FeatureDto.FeatureResponse> findByProductId(Long productId);

    /**
     * Get a feature by ID.
     *
     * @param id the feature ID
     * @return the feature, or empty if not found
     */
    Optional<FeatureDto.FeatureResponse> findById(Long id);

    /**
     * Create a new feature with auto-generated embedding.
     *
     * @param request the feature request
     * @return the created feature
     */
    FeatureDto.FeatureResponse saveWithEmbedding(FeatureDto.FeatureRequest request);

    /**
     * Update an existing feature and regenerate embedding.
     *
     * @param id the feature ID
     * @param request the feature request
     * @return the updated feature
     */
    FeatureDto.FeatureResponse update(Long id, FeatureDto.FeatureRequest request);

    /**
     * Delete a feature.
     *
     * @param id the feature ID
     */
    void delete(Long id);

    /**
     * Search for similar features by embedding.
     *
     * @param query the search query
     * @param topK the number of results to return
     * @return list of similar features
     */
    List<FeatureDto.FeatureResponse> searchSimilar(String query, int topK);
}
