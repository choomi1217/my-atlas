package com.myqaweb.feature;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TestCaseImageUrlResolverTest {

    @Test
    void bareFilenameGetsImagesFeaturePrefix() {
        assertEquals("/images/feature/abc.png", TestCaseImageUrlResolver.toImageUrl("abc.png"));
    }

    @Test
    void uuidBareFilenameGetsPrefix() {
        String uuid = "47fefb1c-d1d2-4c10-8ba9-44d1a19c9f35.png";
        assertEquals("/images/feature/" + uuid, TestCaseImageUrlResolver.toImageUrl(uuid));
    }

    @Test
    void alreadyPrefixedValueIsPassedThrough() {
        String prefixed = "/images/feature/xyz.png";
        assertEquals(prefixed, TestCaseImageUrlResolver.toImageUrl(prefixed));
    }

    @Test
    void legacyApiFeatureImagesPrefixIsPreservedAsIs() {
        // V202604171158 migration should have converted these, but if a stray row survived
        // we must not double-prefix it (would produce /images/feature//api/feature-images/...).
        String legacy = "/api/feature-images/old.png";
        assertEquals(legacy, TestCaseImageUrlResolver.toImageUrl(legacy));
    }

    @Test
    void nullReturnsNull() {
        assertNull(TestCaseImageUrlResolver.toImageUrl(null));
    }

    @Test
    void blankReturnsNull() {
        assertNull(TestCaseImageUrlResolver.toImageUrl(""));
        assertNull(TestCaseImageUrlResolver.toImageUrl("   "));
    }
}
