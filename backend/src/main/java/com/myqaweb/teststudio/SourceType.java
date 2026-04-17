package com.myqaweb.teststudio;

/**
 * Input source type for Test Studio jobs.
 * v1 supports MARKDOWN (pasted text) and PDF (uploaded file).
 * v2+ may add FIGMA_URL, NOTION_URL.
 */
public enum SourceType {
    MARKDOWN,
    PDF
}
