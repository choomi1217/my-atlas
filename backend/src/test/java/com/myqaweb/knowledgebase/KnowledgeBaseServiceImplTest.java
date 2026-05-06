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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseServiceImplTest {

    @Mock
    private KnowledgeBaseRepository knowledgeBaseRepository;

    @Mock
    private KbCategoryService categoryService;

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
        kb1 = new KnowledgeBaseEntity();
        kb1.setId(1L);
        kb1.setTitle("Regression Testing");
        kb1.setContent("Best practices for regression");
        kb1.setCategory("Testing");
        kb1.setCreatedAt(now);
        kb1.setUpdatedAt(now);

        kb2 = new KnowledgeBaseEntity();
        kb2.setId(2L);
        kb2.setTitle("API Testing");
        kb2.setContent("How to test REST APIs");
        kb2.setCategory("API");
        kb2.setCreatedAt(now);
        kb2.setUpdatedAt(now);
    }

    // --- findAll ---

    @Test
    void findAll_returnsAllActiveItems() {
        when(knowledgeBaseRepository.findActiveBySearchNewest(null)).thenReturn(List.of(kb1, kb2));

        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll(null, null);

        assertEquals(2, result.size());
        assertEquals("Regression Testing", result.get(0).title());
        assertEquals("API Testing", result.get(1).title());
    }

    @Test
    void findAll_returnsEmptyListWhenEmpty() {
        when(knowledgeBaseRepository.findActiveBySearchNewest(null)).thenReturn(List.of());

        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll(null, null);

        assertTrue(result.isEmpty());
    }

    @Test
    void findAll_withSearchParam() {
        when(knowledgeBaseRepository.findActiveBySearchNewest("API")).thenReturn(List.of(kb2));

        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll("API", null);

        assertEquals(1, result.size());
        assertEquals("API Testing", result.get(0).title());
    }

    @Test
    void findAll_withSortOldest() {
        when(knowledgeBaseRepository.findActiveBySearchOldest(null)).thenReturn(List.of(kb2, kb1));

        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll(null, "oldest");

        assertEquals(2, result.size());
        verify(knowledgeBaseRepository).findActiveBySearchOldest(null);
    }

    @Test
    void findAll_withSortTitle() {
        when(knowledgeBaseRepository.findActiveBySearchTitle(null)).thenReturn(List.of(kb2, kb1));

        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll(null, "title");

        assertEquals(2, result.size());
        verify(knowledgeBaseRepository).findActiveBySearchTitle(null);
    }

    // --- findById ---

    @Test
    void findById_returnsItemWhenExists() {
        when(knowledgeBaseRepository.findActiveById(1L)).thenReturn(Optional.of(kb1));

        Optional<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findById(1L);

        assertTrue(result.isPresent());
        assertEquals("Regression Testing", result.get().title());
        assertEquals("Testing", result.get().category());
    }

    @Test
    void findById_returnsEmptyWhenNotFound() {
        when(knowledgeBaseRepository.findActiveById(99L)).thenReturn(Optional.empty());

        Optional<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findById(99L);

        assertTrue(result.isEmpty());
    }

    // --- create ---

    @Test
    void create_savesAndReturnsResponse() {
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest(
                "New Article", "New content", "QA");
        KnowledgeBaseEntity savedEntity = new KnowledgeBaseEntity();
        savedEntity.setId(3L);
        savedEntity.setTitle("New Article");
        savedEntity.setContent("New content");
        savedEntity.setCategory("QA");
        savedEntity.setCreatedAt(now);
        savedEntity.setUpdatedAt(now);
        when(knowledgeBaseRepository.save(any(KnowledgeBaseEntity.class))).thenReturn(savedEntity);

        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.create(request);

        assertNotNull(result);
        assertEquals("New Article", result.title());
        assertEquals("QA", result.category());
        verify(knowledgeBaseRepository).save(any(KnowledgeBaseEntity.class));
        verify(categoryService).ensureExists("QA");
    }

    // --- update ---

    @Test
    void update_updatesAndReturnsResponse() {
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest(
                "Updated Title", "Updated Content", "Updated Category");
        KnowledgeBaseEntity existingEntity = new KnowledgeBaseEntity();
        existingEntity.setId(1L);
        existingEntity.setTitle("Old");
        existingEntity.setContent("Old");
        KnowledgeBaseEntity savedEntity = new KnowledgeBaseEntity();
        savedEntity.setId(1L);
        savedEntity.setTitle("Updated Title");
        savedEntity.setContent("Updated Content");
        savedEntity.setCategory("Updated Category");
        savedEntity.setCreatedAt(now);
        savedEntity.setUpdatedAt(now);

        when(knowledgeBaseRepository.findActiveById(1L)).thenReturn(Optional.of(existingEntity));
        when(knowledgeBaseRepository.save(any(KnowledgeBaseEntity.class))).thenReturn(savedEntity);

        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.update(1L, request);

        assertNotNull(result);
        assertEquals("Updated Title", result.title());
        assertEquals("Updated Category", result.category());
        verify(categoryService).ensureExists("Updated Category");
    }

    @Test
    void update_throwsWhenNotFound() {
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest("T", "C", null);
        when(knowledgeBaseRepository.findActiveById(99L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> knowledgeBaseService.update(99L, request)
        );
        assertTrue(ex.getMessage().contains("Knowledge Base entry not found"));
        verify(knowledgeBaseRepository, never()).save(any());
    }

    // --- delete ---

    @Test
    void delete_hardDeletesManualEntry() {
        KnowledgeBaseEntity manual = new KnowledgeBaseEntity();
        manual.setId(1L);
        manual.setSource(null); // manual entry
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(manual));

        knowledgeBaseService.delete(1L);

        verify(knowledgeBaseRepository).deleteById(1L);
        verify(knowledgeBaseRepository, never()).softDelete(anyLong(), any());
    }

    @Test
    void delete_softDeletesPdfEntry() {
        KnowledgeBaseEntity pdf = new KnowledgeBaseEntity();
        pdf.setId(2L);
        pdf.setSource("ISTQB Book"); // PDF entry
        when(knowledgeBaseRepository.findById(2L)).thenReturn(Optional.of(pdf));

        knowledgeBaseService.delete(2L);

        verify(knowledgeBaseRepository).softDelete(eq(2L), any(LocalDateTime.class));
        verify(knowledgeBaseRepository, never()).deleteById(anyLong());
    }

    @Test
    void delete_throwsWhenNotFound() {
        when(knowledgeBaseRepository.findById(99L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> knowledgeBaseService.delete(99L)
        );
        assertTrue(ex.getMessage().contains("Knowledge Base entry not found"));
    }

    // --- pinKbEntry ---

    @Test
    void pinKbEntry_success() {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(null);
        when(knowledgeBaseRepository.findActiveById(1L)).thenReturn(Optional.of(entity));
        when(knowledgeBaseRepository.countByPinnedAtIsNotNull()).thenReturn(5L);

        knowledgeBaseService.pinKbEntry(1L);

        verify(knowledgeBaseRepository).updatePinnedAt(eq(1L), any(LocalDateTime.class));
    }

    @Test
    void pinKbEntry_alreadyPinned_throwsIllegalState() {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(now);
        when(knowledgeBaseRepository.findActiveById(1L)).thenReturn(Optional.of(entity));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> knowledgeBaseService.pinKbEntry(1L)
        );
        assertTrue(ex.getMessage().contains("already pinned"));
        verify(knowledgeBaseRepository, never()).updatePinnedAt(anyLong(), any());
    }

    @Test
    void pinKbEntry_maxLimitReached_throwsIllegalState() {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(null);
        when(knowledgeBaseRepository.findActiveById(1L)).thenReturn(Optional.of(entity));
        when(knowledgeBaseRepository.countByPinnedAtIsNotNull()).thenReturn(10L);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> knowledgeBaseService.pinKbEntry(1L)
        );
        assertTrue(ex.getMessage().contains("Maximum"));
        assertTrue(ex.getMessage().contains("10"));
    }

    @Test
    void pinKbEntry_atNinePinned_succeeds() {
        // 9 currently pinned → 10번째 핀 가능
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(null);
        when(knowledgeBaseRepository.findActiveById(1L)).thenReturn(Optional.of(entity));
        when(knowledgeBaseRepository.countByPinnedAtIsNotNull()).thenReturn(9L);

        knowledgeBaseService.pinKbEntry(1L);

        verify(knowledgeBaseRepository).updatePinnedAt(eq(1L), any(LocalDateTime.class));
    }

    @Test
    void pinKbEntry_notFound_throwsIllegalArgument() {
        when(knowledgeBaseRepository.findActiveById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> knowledgeBaseService.pinKbEntry(99L));
    }

    // --- unpinKbEntry ---

    @Test
    void unpinKbEntry_success() {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(now);
        when(knowledgeBaseRepository.findActiveById(1L)).thenReturn(Optional.of(entity));

        knowledgeBaseService.unpinKbEntry(1L);

        verify(knowledgeBaseRepository).updatePinnedAt(1L, null);
    }

    @Test
    void unpinKbEntry_notPinned_throwsIllegalState() {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(1L);
        entity.setPinnedAt(null);
        when(knowledgeBaseRepository.findActiveById(1L)).thenReturn(Optional.of(entity));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> knowledgeBaseService.unpinKbEntry(1L)
        );
        assertTrue(ex.getMessage().contains("not pinned"));
    }

    @Test
    void unpinKbEntry_notFound_throwsIllegalArgument() {
        when(knowledgeBaseRepository.findActiveById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> knowledgeBaseService.unpinKbEntry(99L));
    }

    // --- getCuratedFaqs (v7: pinned only) ---

    @Test
    void getCuratedFaqs_returnsPinnedOnly() {
        KnowledgeBaseEntity pinned1 = createKbEntity(1L, "Pinned 1", 0);
        pinned1.setPinnedAt(now.minusDays(2));

        KnowledgeBaseEntity pinned2 = createKbEntity(2L, "Pinned 2", 0);
        pinned2.setPinnedAt(now.minusDays(1));

        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of(pinned1, pinned2));

        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.getCuratedFaqs();

        assertEquals(2, result.size());
        assertEquals("Pinned 1", result.get(0).title());
        assertEquals("Pinned 2", result.get(1).title());
    }

    @Test
    void getCuratedFaqs_emptyWhenNoPinned() {
        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of());

        assertTrue(knowledgeBaseService.getCuratedFaqs().isEmpty());
    }

    @Test
    void getCuratedFaqs_doesNotCallHitCountQueries() {
        // v7: hit_count 큐레이션 제거 — findTopByHitCount는 호출되지 않아야 함
        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of());

        knowledgeBaseService.getCuratedFaqs();

        verify(knowledgeBaseRepository, never()).findTopByHitCount(anyInt());
    }

    @Test
    void getCuratedFaqs_responseIncludesSnippet() {
        KnowledgeBaseEntity pinned = createKbEntity(1L, "Title", 0);
        pinned.setContent("# Heading\n\nSome **bold** content for snippet generation.");
        pinned.setPinnedAt(now);

        when(knowledgeBaseRepository.findPinned()).thenReturn(List.of(pinned));

        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.getCuratedFaqs();

        assertEquals(1, result.size());
        String snippet = result.get(0).snippet();
        assertNotNull(snippet);
        assertFalse(snippet.contains("**"));
        assertFalse(snippet.contains("#"));
        assertTrue(snippet.contains("bold"));
    }

    // --- Response mapping ---

    @Test
    void toResponse_mapsAllFieldsIncludingDeletedAt() {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(5L);
        entity.setTitle("Title");
        entity.setContent("Content");
        entity.setCategory("Category");
        entity.setSource("book-source");
        entity.setHitCount(7);
        entity.setPinnedAt(now);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity.setDeletedAt(null);

        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.toResponse(entity);

        assertEquals(5L, result.id());
        assertEquals("Title", result.title());
        assertEquals("Content", result.content());
        assertEquals("Content", result.snippet());
        assertEquals("Category", result.category());
        assertEquals("book-source", result.source());
        assertEquals(7, result.hitCount());
        assertEquals(now, result.pinnedAt());
        assertNull(result.deletedAt());
    }

    // --- buildSnippet ---

    @Test
    void buildSnippet_shortContent_returnsAsIs() {
        String result = KnowledgeBaseServiceImpl.buildSnippet("Short content");
        assertEquals("Short content", result);
    }

    @Test
    void buildSnippet_longContent_truncatedToHundredCharsWithEllipsis() {
        String longContent = "a".repeat(150);
        String result = KnowledgeBaseServiceImpl.buildSnippet(longContent);
        assertTrue(result.length() <= 103); // 100 + "..."
        assertTrue(result.endsWith("..."));
    }

    @Test
    void buildSnippet_stripsMarkdownFromContent() {
        String content = "# Heading\n\n**Bold text** and *italic* with `code`.";
        String result = KnowledgeBaseServiceImpl.buildSnippet(content);
        assertFalse(result.contains("#"));
        assertFalse(result.contains("**"));
        assertFalse(result.contains("`"));
        assertTrue(result.contains("Heading"));
        assertTrue(result.contains("Bold text"));
    }

    @Test
    void buildSnippet_nullContent_returnsEmptyString() {
        assertEquals("", KnowledgeBaseServiceImpl.buildSnippet(null));
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
    void stripMarkdown_stripsHeadings() {
        assertEquals("Title", KnowledgeBaseServiceImpl.stripMarkdown("# Title"));
    }

    @Test
    void stripMarkdown_stripsBoldAndItalic() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("This is **bold** and *italic* text");
        assertFalse(result.contains("**"));
        assertFalse(result.contains("*"));
        assertTrue(result.contains("bold"));
    }

    @Test
    void stripMarkdown_stripsImages_keepsAltText() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("See ![diagram](http://example.com/img.png) here");
        assertFalse(result.contains("!["));
        assertTrue(result.contains("diagram"));
    }

    @Test
    void stripMarkdown_stripsLinks_keepsText() {
        String result = KnowledgeBaseServiceImpl.stripMarkdown("Click [here](http://example.com) for more");
        assertFalse(result.contains("[here]"));
        assertTrue(result.contains("here"));
    }

    @Test
    void stripMarkdown_stripsFencedCodeBlocks() {
        String input = "Before\n```java\nSystem.out.println(\"hello\");\n```\nAfter";
        String result = KnowledgeBaseServiceImpl.stripMarkdown(input);
        assertFalse(result.contains("```"));
        assertTrue(result.contains("Before"));
    }

    @Test
    void stripMarkdown_plainText_unchanged() {
        String input = "This is plain text without any markdown.";
        assertEquals(input, KnowledgeBaseServiceImpl.stripMarkdown(input));
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
