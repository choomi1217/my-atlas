package com.myqaweb.teststudio;

import com.myqaweb.feature.CompanyEntity;
import com.myqaweb.feature.Platform;
import com.myqaweb.feature.ProductEntity;
import com.myqaweb.feature.SegmentEntity;
import com.myqaweb.feature.SegmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link SegmentPathResolver}.
 *
 * <p>Covers the context builder (dedup semantics), longest-prefix resolve, and
 * resolveOrCreate flow (including cross-call dedup via a shared {@code ResolverContext}).
 */
@ExtendWith(MockitoExtension.class)
class SegmentPathResolverTest {

    @Mock
    private SegmentRepository segmentRepository;

    private SegmentPathResolver resolver;

    private ProductEntity product;

    @BeforeEach
    void setUp() {
        resolver = new SegmentPathResolver(segmentRepository);
        CompanyEntity company = new CompanyEntity(1L, "Acme", true, LocalDateTime.now());
        product = new ProductEntity(
                10L, company, "Payment App", Platform.MOBILE,
                "Payment product", null, LocalDateTime.now()
        );
    }

    // --- helpers ---

    private SegmentEntity seg(long id, String name, SegmentEntity parent) {
        SegmentEntity s = new SegmentEntity();
        s.setId(id);
        s.setName(name);
        s.setProduct(product);
        s.setParent(parent);
        return s;
    }

    // --- buildContext ---

    @Test
    void buildContext_callsRepositoryOnce() {
        when(segmentRepository.findAllByProductId(10L)).thenReturn(List.of());

        resolver.buildContext(10L);

        verify(segmentRepository, times(1)).findAllByProductId(10L);
        verifyNoMoreInteractions(segmentRepository);
    }

    @Test
    void buildContext_duplicateSiblings_keepsLowestId() {
        // Two siblings under root with same name "결제" — lowest id (5) should win.
        SegmentEntity low = seg(5L, "결제", null);
        SegmentEntity high = seg(42L, "결제", null);
        // Return them out of id order to ensure internal sort-by-id is load-bearing.
        when(segmentRepository.findAllByProductId(10L)).thenReturn(List.of(high, low));

        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        Long[] resolved = resolver.resolve(ctx, List.of("결제"));
        assertArrayEquals(new Long[]{5L}, resolved, "Lower id must win duplicate dedup");
    }

    // --- resolve ---

    @Test
    void resolve_nullCtx_returnsEmpty() {
        Long[] result = resolver.resolve(null, List.of("anything"));
        assertArrayEquals(new Long[0], result);
    }

    @Test
    void resolve_emptyNames_returnsEmpty() {
        when(segmentRepository.findAllByProductId(10L)).thenReturn(List.of());
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        assertArrayEquals(new Long[0], resolver.resolve(ctx, List.of()));
        assertArrayEquals(new Long[0], resolver.resolve(ctx, null));
    }

    @Test
    void resolve_rootMissing_returnsEmpty() {
        // Tree has "결제" but caller asks for "로그인" at root → first miss, empty.
        SegmentEntity payment = seg(1L, "결제", null);
        when(segmentRepository.findAllByProductId(10L)).thenReturn(List.of(payment));
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        Long[] result = resolver.resolve(ctx, List.of("로그인", "소셜"));

        assertArrayEquals(new Long[0], result);
    }

    @Test
    void resolve_allNamesMatch_returnsFullPath() {
        SegmentEntity payment = seg(1L, "결제", null);
        SegmentEntity nfc = seg(2L, "NFC", payment);
        SegmentEntity timeout = seg(3L, "타임아웃", nfc);
        when(segmentRepository.findAllByProductId(10L))
                .thenReturn(List.of(payment, nfc, timeout));
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        Long[] result = resolver.resolve(ctx, List.of("결제", "NFC", "타임아웃"));

        assertArrayEquals(new Long[]{1L, 2L, 3L}, result);
    }

    @Test
    void resolve_partialMatch_returnsLongestPrefix() {
        SegmentEntity payment = seg(1L, "결제", null);
        SegmentEntity nfc = seg(2L, "NFC", payment);
        // No "타임아웃" segment exists under NFC.
        when(segmentRepository.findAllByProductId(10L))
                .thenReturn(List.of(payment, nfc));
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        Long[] result = resolver.resolve(ctx, List.of("결제", "NFC", "타임아웃"));

        assertArrayEquals(new Long[]{1L, 2L}, result, "Should return longest-prefix match");
    }

    @Test
    void resolve_trimsWhitespace() {
        SegmentEntity payment = seg(1L, "결제", null);
        when(segmentRepository.findAllByProductId(10L)).thenReturn(List.of(payment));
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        Long[] result = resolver.resolve(ctx, List.of("  결제  "));

        assertArrayEquals(new Long[]{1L}, result);
    }

    @Test
    void resolve_isCaseSensitive() {
        // Stored name is lowercase "payment"; caller asks for "Payment" — must miss.
        SegmentEntity payment = seg(1L, "payment", null);
        when(segmentRepository.findAllByProductId(10L)).thenReturn(List.of(payment));
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        Long[] result = resolver.resolve(ctx, List.of("Payment"));

        assertArrayEquals(new Long[0], result, "Case-sensitive matching — 'Payment' ≠ 'payment'");
    }

    // --- resolveOrCreate ---

    @Test
    void resolveOrCreate_allExistingNames_noneCreated() {
        SegmentEntity payment = seg(1L, "결제", null);
        SegmentEntity nfc = seg(2L, "NFC", payment);
        when(segmentRepository.findAllByProductId(10L))
                .thenReturn(List.of(payment, nfc));
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        SegmentPathResolver.ResolveResult result =
                resolver.resolveOrCreate(ctx, product, List.of("결제", "NFC"));

        assertArrayEquals(new Long[]{1L, 2L}, result.path());
        assertEquals(0, result.createdCount());
        verify(segmentRepository, never()).save(any());
    }

    @Test
    void resolveOrCreate_allNewNames_createsInOrder_andDedupsAcrossCalls() {
        // Start with an empty tree. Expect 3 creates for first call, then 2 creates for second
        // (root "결제" is now in the shared ctx, so "UI 렌더링" ancestor dedups through).
        when(segmentRepository.findAllByProductId(10L)).thenReturn(List.of());
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        AtomicLong idSeq = new AtomicLong(100L);
        when(segmentRepository.save(any(SegmentEntity.class))).thenAnswer(inv -> {
            SegmentEntity s = inv.getArgument(0);
            s.setId(idSeq.getAndIncrement());
            return s;
        });

        // Call 1: create 결제 → 네트워크 오류 → UI 렌더링 (3 creates, ids 100/101/102)
        SegmentPathResolver.ResolveResult r1 =
                resolver.resolveOrCreate(ctx, product,
                        List.of("결제 실패", "네트워크 오류", "UI 렌더링"));

        assertArrayEquals(new Long[]{100L, 101L, 102L}, r1.path());
        assertEquals(3, r1.createdCount());

        // Call 2: "결제 실패" root already in ctx — dedups. Creates "단말기 오류"(new) + "UI 렌더링"(new under 단말기 오류).
        SegmentPathResolver.ResolveResult r2 =
                resolver.resolveOrCreate(ctx, product,
                        List.of("결제 실패", "단말기 오류", "UI 렌더링"));

        assertArrayEquals(new Long[]{100L, 103L, 104L}, r2.path(),
                "First segment must reuse id=100 (dedup) across calls");
        assertEquals(2, r2.createdCount(), "Only 2 new segments should be created on the 2nd call");

        // Total saves: 3 + 2 = 5. The shared root was saved only once.
        verify(segmentRepository, times(5)).save(any(SegmentEntity.class));

        // Verify the root "결제 실패" save happened exactly once in total
        ArgumentCaptor<SegmentEntity> saveCaptor = ArgumentCaptor.forClass(SegmentEntity.class);
        verify(segmentRepository, times(5)).save(saveCaptor.capture());
        long rootSaveCount = saveCaptor.getAllValues().stream()
                .filter(s -> "결제 실패".equals(s.getName()) && s.getParent() == null)
                .count();
        assertEquals(1, rootSaveCount, "Root '결제 실패' must only be saved once across both calls");
    }

    @Test
    void resolveOrCreate_partialExisting_createsMissingWithCorrectParent() {
        // Tree has "결제" root only. Caller asks for ["결제", "NFC", "타임아웃"] — need to create NFC and 타임아웃.
        SegmentEntity payment = seg(1L, "결제", null);
        when(segmentRepository.findAllByProductId(10L)).thenReturn(new ArrayList<>(List.of(payment)));
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        AtomicLong idSeq = new AtomicLong(50L);
        when(segmentRepository.save(any(SegmentEntity.class))).thenAnswer(inv -> {
            SegmentEntity s = inv.getArgument(0);
            s.setId(idSeq.getAndIncrement());
            return s;
        });

        SegmentPathResolver.ResolveResult result =
                resolver.resolveOrCreate(ctx, product, List.of("결제", "NFC", "타임아웃"));

        assertArrayEquals(new Long[]{1L, 50L, 51L}, result.path());
        assertEquals(2, result.createdCount());

        ArgumentCaptor<SegmentEntity> saveCaptor = ArgumentCaptor.forClass(SegmentEntity.class);
        verify(segmentRepository, times(2)).save(saveCaptor.capture());

        List<SegmentEntity> saved = saveCaptor.getAllValues();
        // First save: NFC with parent = 결제 (id=1)
        assertEquals("NFC", saved.get(0).getName());
        assertNotNull(saved.get(0).getParent());
        assertEquals(1L, saved.get(0).getParent().getId());
        assertEquals(product, saved.get(0).getProduct());

        // Second save: 타임아웃 with parent = NFC (id=50, assigned by save answer)
        assertEquals("타임아웃", saved.get(1).getName());
        assertNotNull(saved.get(1).getParent());
        assertEquals(50L, saved.get(1).getParent().getId());
        assertEquals(product, saved.get(1).getProduct());
    }

    @Test
    void resolveOrCreate_emptyNames_returnsEmptyResultNoSave() {
        when(segmentRepository.findAllByProductId(10L)).thenReturn(List.of());
        SegmentPathResolver.ResolverContext ctx = resolver.buildContext(10L);

        SegmentPathResolver.ResolveResult r1 = resolver.resolveOrCreate(ctx, product, List.of());
        SegmentPathResolver.ResolveResult r2 = resolver.resolveOrCreate(ctx, product, null);
        SegmentPathResolver.ResolveResult r3 = resolver.resolveOrCreate(null, product, List.of("x"));
        SegmentPathResolver.ResolveResult r4 = resolver.resolveOrCreate(ctx, null, List.of("x"));

        for (SegmentPathResolver.ResolveResult r : Arrays.asList(r1, r2, r3, r4)) {
            assertArrayEquals(new Long[0], r.path());
            assertEquals(0, r.createdCount());
        }
        verify(segmentRepository, never()).save(any(SegmentEntity.class));
    }
}
