package com.myqaweb.feature;

import java.util.List;

/**
 * Service interface for Version operations.
 */
public interface VersionService {
    /**
     * Create a new version.
     */
    VersionDto.VersionDetail create(VersionDto.CreateVersionRequest request);

    /**
     * Get all versions for a product.
     */
    List<VersionDto.VersionSummary> getAllByProductId(Long productId);

    /**
     * Get version by ID with details.
     */
    VersionDto.VersionDetail getById(Long id);

    /**
     * Update version.
     */
    VersionDto.VersionDetail update(Long id, VersionDto.UpdateVersionRequest request);

    /**
     * Copy a version to create a new one.
     */
    VersionDto.VersionDetail copy(Long id, VersionDto.VersionCopyRequest request);

    /**
     * Delete version.
     */
    void delete(Long id);
}
