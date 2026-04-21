package com.myqaweb.monitoring;

/**
 * Identifies which feature triggered an AI API call.
 */
public enum AiFeature {
    SENIOR_CHAT,
    TC_DRAFT,
    TEST_STUDIO,
    PDF_CLEANUP,
    EMBEDDING_SENIOR,
    EMBEDDING_PDF,
    EMBEDDING_TEST_STUDIO
}
