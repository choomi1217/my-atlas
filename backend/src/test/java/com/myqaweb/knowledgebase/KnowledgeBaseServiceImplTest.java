package com.myqaweb.knowledgebase;

import com.myqaweb.common.EmbeddingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for KnowledgeBaseServiceImpl.
 * Covers CRUD, pin/unpin, curated FAQ, toResponse mapping, and stripMarkdown.
 */
@ExtendWith(MockitoExtension.class)
class KnowledgeBaseServiceImplTest {

    @Mock
    private KnowledgeBaseRepository knowledgeBaseRepository;

    @Mock
    private EmbeddingService embeddingService;

    @InjectMocks
    private KnowledgeBaseServiceImpl knowledgeBaseService;

    private KnowledgeBaseEntity kb1;
    private KnowledgeBaseEntity kb2;
    private LocalDateTime now;

    @BeforeEach
    void setUp() {
        now = LocalDateTime.now();
        kb1 = new KnowledgeBaseEntity(1L, "Regression Testing", "Best practices for regression",
                "Testing", "regression,best-practices", null, null, 0, null, now, now);
        kb2 = new KnowledgeBaseEntity(2L, "API Testing", "How to test REST APIs",
                "API", "api,rest", null, null, 0, null, now, now);
    }

    // --- findAll ---

    @Test
    void findAll_returnsAllItems() {
        // Arrange
        when(knowledgeBaseRepository.findAll()).thenReturn(List.of(kb1, kb2));

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll();

        // Assert
        assertEquals(2, result.size());
        assertEquals("Regression Testing", result.get(0).title());
        assertEquals("API Testing", result.get(1).title());
        verify(knowledgeBaseRepository).findAll();
    }

    @Test
    void findAll_returnsEmptyListWhenEmpty() {
        // Arrange
        when(knowledgeBaseRepository.findAll()).thenReturn(List.of());

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll();

        // Assert
        assertTrue(result.isEmpty());
    }

    // --- findById ---

    @Test
    void findById_returnsItemWhenExists() {
        // Arrange
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(kb1));

        // Act
        Optional<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findById(1L);

        // Assert
        assertTrue(result.isPresent());
        assertEquals("Regression Testing", result.get().title());
        assertEquals("Testing", result.get().category());
        verify(knowledgeBaseRepository).findById(1L);
    }

    @Test
    void findById_returnsEmptyWhenNotFound() {
        // Arrange
        when(knowledgeBaseRepository.findById(99L)).thenReturn(Optional.empty());

        // Act
        Optional<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findById(99L);

        // Assert
        assertTrue(result.isEmpty());
    }

    // --- create ---

    @Test
    void create_savesAndReturnsResponse() {
        // Arrange
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest(
                "New Article", "New content", "QA", "qa,new");
        KnowledgeBaseEntity savedEntity = new KnowledgeBaseEntity(
                3L, "New Article", "New content", "QA", "qa,new", null, null, 0, null, now, now);
        when(knowledgeBaseRepository.save(any(KnowledgeBaseEntity.class))).thenReturn(savedEntity);

        // Act
        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.create(request);

        // Assert
        assertNotNull(result);
        assertEquals("New Article", result.title());
        assertEquals("QA", result.category());
        verify(knowledgeBaseRepository).save(any(KnowledgeBaseEntity.class));
    }

    // --- update ---

    @Test
    void update_updatesAndReturnsResponse() {
        // Arrange
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest(
                "Updated Title", "Updated Content", "Updated Category", "updated");
        KnowledgeBaseEntity existingEntity = new KnowledgeBaseEntity(
                1L, "Old", "Old", "Old", "old", null, null, 0, null, now, now);
        KnowledgeBaseEntity savedEntity = new KnowledgeBaseEntity(
                1L, "Updated Title", "Updated Content", "Updated Category", "updated", null, null, 0, null, now, now);

        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(existingEntity));
        when(knowledgeBaseRepository.save(any(KnowledgeBaseEntity.class))).thenReturn(savedEntity);

        // Act
        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.update(1L, request);

        // Assert
        assertNotNull(result);
        assertEquals("Updated Title", result.title());
        assertEquals("Updated Category", result.category());
        verify(knowledgeBaseRepository, atLeastOnce()).findById(1L);
        verify(knowledgeBaseRepository, atLeastOnce()).save(any(KnowledgeBaseEntity.class));
    }

    @Test
    void update_throwsWhenNotFound() {
        // Arrange
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest("T", "C", null, null);
        when(knowledgeBaseRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> knowledgeBaseService.update(99L, request)
        );
        assertTrue(ex.getMessage().contains("Knowledge Base entry not found"));
        verify(knowledgeBaseRepository, never()).save(any());
    }

    // --- delete ---

    @Test
    void delete_deletesWhenExists() {
        // Arrange
        when(knowledgeBaseRepository.existsById(1L)).thenReturn(true);

        // Act
        knowledgeBaseService.delete(1L);

        // Assert
        verify(knowledgeBaseRepository).existsById(1L);
        verify(knowledgeBaseRepository).deleteById(1L);
    }

    @Test
    void delete_throwsWhenNotFound() {
        // Arrange
        when(knowledgeBaseRepository.existsById(99L)).thenReturn(false);

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> knowledgeBaseService.delete(99L)
        );
        assertTrue(ex.getMessage().contains("Knowledge Base entry not found"));
        verify(knowledgeBaseRepository, never()).deleteById(anyLong());
    }

    // --- pinKbEntry ---

    @Test
    void pinKbEntry_success() {
        // Arrange — entity not yet pinned, under limit
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(null);
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(entity));
        when(knowledgeBaseRepository.countByPinnedAtIsNotNull()).thenReturn(5L);

        // Act
        knowledgeBaseService.pinKbEntry(1L);

        // Assert
        verify(knowledgeBaseRepository).updatePinnedAt(eq(1L), any(LocalDateTime.class));
    }

    @Test
    void pinKbEntry_alreadyPinned_throwsIllegalState() {
        // Arrange — entity already pinned
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(now);
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(entity));

        // Act & Assert
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> knowledgeBaseService.pinKbEntry(1L)
        );
        assertTrue(ex.getMessage().contains("already pinned"));
        verify(knowledgeBaseRepository, never()).updatePinnedAt(anyLong(), any());
    }

    @Test
    void pinKbEntry_maxLimitReached_throwsIllegalState() {
        // Arrange — at max 15 pinned entries
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(null);
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(entity));
        when(knowledgeBaseRepository.countByPinnedAtIsNotNull()).thenReturn(15L);

        // Act & Assert
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> knowledgeBaseService.pinKbEntry(1L)
        );
        assertTrue(ex.getMessage().contains("Maximum"));
        assertTrue(ex.getMessage().contains("15"));
        verify(knowledgeBaseRepository, never()).updatePinnedAt(anyLong(), any());
    }

    @Test
    void pinKbEntry_notFound_throwsIllegalArgument() {
        // Arrange
        when(knowledgeBaseRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> knowledgeBaseService.pinKbEntry(99L)
        );
        assertTrue(ex.getMessage().contains("Knowledge Base entry not found"));
    }

    // --- unpinKbEntry ---

    @Test
    void unpinKbEntry_success() {
        // Arrange — entity is currently pinned
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(now);
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(entity));

        // Act
        knowledgeBaseService.unpinKbEntry(1L);

        // Assert — sets pinnedAt to null
        verify(knowledgeBaseRepository).updatePinnedAt(1L, null);
    }

    @Test
    void unpinKbEntry_notPinned_throwsIllegalState() {
        // Arrange — entity is NOT pinned
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(null);
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(entity));

        // Act & Assert
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> knowledgeBaseService.unpinKbEntry(1L)
        );
        assertTrue(ex.getMessage().contains("not pinned"));
        verify(knowledgeBaseRepository, never()).updatePinnedAt(anyLong(), any());
    }

    @Test
    void unpinKbEntry_notFound_throwsIllegalArgument() {
        // Arrange
        when(knowledgeBaseRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> knowledgeBaseService.unpinKbEntry(99L)
        );
        assertTrue(ex.getMessage().contains("Knowledge Base entry not found"));
    }

    // --- getCuratedFaqs ---

    @Test
    void getCuratedFaqs_combinesPinnedAndTopHits() {
        // Arrange — 2 pinned entries + 2 top hit entries (one overlaps with pinned)
        KnowledgeBaseEntity pinned1 = new KnowledgeBaseEntity();
        pinned1.setId(1L);
        pinned1.setTitle("Pinned 1");
        pinned1.setContent("Content");
        pinned1.setPinnedAt(now.minusDays(2));
        pinned1.setHitCount(3);

        KnowledgeBaseEntity pinned2 = new KnowledgeBaseEntity();
        pinned2.setId(2L);
        pinned2.setTitle("Pinned 2");
        pinned2.setContent("Content");
        pinned2.setPinnedAt(now.minusDays(1));
        pinned2.setHitCount(0);

        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of(pinned1, pinned2));

        // Top hits: id=1 overlaps with pinned, id=3 is unique with hitCount > 0
        KnowledgeBaseEntity hit1 = new KnowledgeBaseEntity();
        hit1.setId(1L); // overlaps with pinned1
        hit1.setTitle("Pinned 1");
        hit1.setHitCount(3);

        KnowledgeBaseEntity hit2 = new KnowledgeBaseEntity();
        hit2.setId(3L);
        hit2.setTitle("Top Hit");
        hit2.setContent("Content");
        hit2.setHitCount(5);

        when(knowledgeBaseRepository.findTopByHitCount(anyInt())).thenReturn(List.of(hit2, hit1));

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.getCuratedFaqs();

        // Assert — pinned first, then non-overlapping hits
        assertEquals(3, result.size());
        assertEquals("Pinned 1", result.get(0).title());
        assertEquals("Pinned 2", result.get(1).title());
        assertEquals("Top Hit", result.get(2).title());
    }

    @Test
    void getCuratedFaqs_deduplicatesPinnedFromHits() {
        // Arrange — all top hits are also pinned
        KnowledgeBaseEntity pinned1 = new KnowledgeBaseEntity();
        pinned1.setId(1L);
        pinned1.setTitle("Pinned");
        pinned1.setContent("Content");
        pinned1.setPinnedAt(now);
        pinned1.setHitCount(10);

        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of(pinned1));

        KnowledgeBaseEntity hit1 = new KnowledgeBaseEntity();
        hit1.setId(1L); // same as pinned
        hit1.setHitCount(10);

        when(knowledgeBaseRepository.findTopByHitCount(anyInt())).thenReturn(List.of(hit1));

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.getCuratedFaqs();

        // Assert — only 1 entry (deduplicated)
        assertEquals(1, result.size());
        assertEquals("Pinned", result.get(0).title());
    }

    @Test
    void getCuratedFaqs_excludesHitsWithZeroHitCount() {
        // Arrange — no pinned, one hit with hitCount=0
        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of());

        KnowledgeBaseEntity hitZero = new KnowledgeBaseEntity();
        hitZero.setId(1L);
        hitZero.setTitle("Zero Hits");
        hitZero.setContent("Content");
        hitZero.setHitCount(0);

        when(knowledgeBaseRepository.findTopByHitCount(anyInt())).thenReturn(List.of(hitZero));

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.getCuratedFaqs();

        // Assert — zero hit count entries are excluded
        assertTrue(result.isEmpty());
    }

    @Test
    void getCuratedFaqs_emptyWhenNoPinnedAndNoHits() {
        // Arrange
        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of());
        when(knowledgeBaseRepository.findTopByHitCount(anyInt())).thenReturn(List.of());

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.getCuratedFaqs();

        // Assert
        assertTrue(result.isEmpty());
    }

    @Test
    void getCuratedFaqs_limitsHitsToTopK5() {
        // Arrange — no pinned, 7 hits all with hitCount > 0
        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of());

        KnowledgeBaseEntity hit1 = createKbEntity(1L, "Hit 1", 10);
        KnowledgeBaseEntity hit2 = createKbEntity(2L, "Hit 2", 9);
        KnowledgeBaseEntity hit3 = createKbEntity(3L, "Hit 3", 8);
        KnowledgeBaseEntity hit4 = createKbEntity(4L, "Hit 4", 7);
        KnowledgeBaseEntity hit5 = createKbEntity(5L, "Hit 5", 6);
        KnowledgeBaseEntity hit6 = createKbEntity(6L, "Hit 6", 5);
        KnowledgeBaseEntity hit7 = createKbEntity(7L, "Hit 7", 4);

        when(knowledgeBaseRepository.findTopByHitCount(anyInt()))
                .thenReturn(List.of(hit1, hit2, hit3, hit4, hit5, hit6, hit7));

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.getCuratedFaqs();

        // Assert — only top 5 hits (HIT_TOP_K = 5)
        assertEquals(5, result.size());
        assertEquals("Hit 1", result.get(0).title());
        assertEquals("Hit 5", result.get(4).title());
    }

    // --- Response mapping ---

    @Test
    void toResponse_mapsAllFieldsIncludingHitCountAndPinnedAt() {
        // Arrange
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity(
                5L, "Title", "Content", "Category", "tags", "book-source", null,
                7, now, now, now);

        // Act
        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.toResponse(entity);

        // Assert
        assertEquals(5L, result.id());
        assertEquals("Title", result.title());
        assertEquals("Content", result.content());
        assertEquals("Category", result.category());
        assertEquals("tags", result.tags());
        assertEquals("book-source", result.source());
        assertEquals(7, result.hitCount());
        assertEquals(now, result.pinnedAt());
        assertEquals(now, result.createdAt());
        assertEquals(now, result.updatedAt());
    }

    @Test
    void toResponse_handlesNullPinnedAt() {
        // Arrange
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity(
                1L, "Title", "Content", null, null, null, null, 0, null, now, now);

        // Act
        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.toResponse(entity);

        // Assert
        assertNull(result.pinnedAt());
        assertEquals(0, result.hitCount());
    }

    // --- stripMarkdown ---

    @Test
    void stripMarkdown_nullInput_returnsEmpty() {
        assertEquals("", KnowledgeBaseServiceImpl.stripMarkdown(null));
    }

    @Test
    void stripMarkdown_blankInput_returnsEmpty() {
        assertEquals("", KnowledgeBaseServiceImpl.stripMarkdown("   "));
    }

    @Test
    void stripMarkdown_emptyInput_returnsEmpty() {
        assertEquals("", KnowledgeBaseServiceImpl.stripMarkdown(""));
    }

    @Test
    void stripMarkdown_stripsHeadings() {
        assertEquals("Title", KnowledgeBaseServiceImpl.stripMarkdown("# Title"));
        assertEquals("Subtitle", KnowledgeBaseServiceImpl.stripMarkdown("## Subtitle"));
        assertEquals("Sub-sub", KnowledgeBaseServiceImpl.stripMarkdown("### Sub-sub"));
    }

    @Test
    void stripMarkdown_stripsBoldAndItalic() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("This is **bold** and *italic* text");
        assertFalse(result.contains("**"));
        assertFalse(result.contains("*"));
        assertTrue(result.contains("bold"));
        assertTrue(result.contains("italic"));
        assertTrue(result.contains("text"));
    }

    @Test
    void stripMarkdown_stripsUnderscoreBoldItalic() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("This is __bold__ and _italic_ text");
        assertFalse(result.contains("__"));
        assertFalse(result.contains("_"));
        assertTrue(result.contains("bold"));
        assertTrue(result.contains("italic"));
    }

    @Test
    void stripMarkdown_stripsImages_keepsAltText() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("See ![diagram](http://example.com/img.png) here");
        assertFalse(result.contains("!["));
        assertFalse(result.contains("http://example.com"));
        assertTrue(result.contains("diagram"));
    }

    @Test
    void stripMarkdown_stripsLinks_keepsText() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("Click [here](http://example.com) for more");
        assertFalse(result.contains("[here]"));
        assertFalse(result.contains("http://example.com"));
        assertTrue(result.contains("here"));
        assertTrue(result.contains("for more"));
    }

    @Test
    void stripMarkdown_stripsFencedCodeBlocks() {
        String input = "Before\n```java\nSystem.out.println(\"hello\");\n```\nAfter";
        String result = KnowledgeBaseServiceImpl.stripMarkdown(input);
        assertFalse(result.contains("```"));
        assertFalse(result.contains("System.out.println"));
        assertTrue(result.contains("Before"));
        assertTrue(result.contains("After"));
    }

    @Test
    void stripMarkdown_stripsInlineCode() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("Use `assertEquals` for assertions");
        assertFalse(result.contains("`"));
        assertTrue(result.contains("assertions"));
    }

    @Test
    void stripMarkdown_stripsStrikethrough() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("This is ~~deleted~~ text");
        assertFalse(result.contains("~~"));
        assertTrue(result.contains("text"));
    }

    @Test
    void stripMarkdown_stripsHorizontalRules() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("Above\n---\nBelow");
        assertFalse(result.contains("---"));
    }

    @Test
    void stripMarkdown_plainText_unchanged() {
        String input = "This is plain text without any markdown.";
        assertEquals(input, KnowledgeBaseServiceImpl.stripMarkdown(input));
    }

    @Test
    void stripMarkdown_mixedMarkdown_cleansAll() {
        String input = "# Title\n\nThis is **bold** with a [link](http://url) and `code`.";
        String result = KnowledgeBaseServiceImpl.stripMarkdown(input);
        assertFalse(result.contains("#"));
        assertFalse(result.contains("**"));
        assertFalse(result.contains("[link]"));
        assertFalse(result.contains("`"));
        assertTrue(result.contains("Title"));
        assertTrue(result.contains("bold"));
        assertTrue(result.contains("link"));
    }

    // --- Helper ---

    private KnowledgeBaseEntity createKbEntity(Long id, String title, int hitCount) {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(id);
        entity.setTitle(title);
        entity.setContent("Content for " + title);
        entity.setHitCount(hitCount);
        return entity;
    }
}
