package com.myqaweb.feature;

/**
 * Resolves the public URL for a TestCase image filename.
 *
 * Images are served from CloudFront at /images/feature/{filename}. Historical
 * rows may have the legacy /images/feature/ prefix already baked into the
 * filename column (via V202604171158 migration), so the resolver passes those
 * through unchanged.
 */
final class TestCaseImageUrlResolver {
    private static final String PREFIX = "/images/feature/";

    private TestCaseImageUrlResolver() {}

    static String toImageUrl(String filename) {
        if (filename == null || filename.isBlank()) return null;
        if (filename.startsWith("/")) return filename;
        return PREFIX + filename;
    }
}
