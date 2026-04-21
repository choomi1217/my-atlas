package com.myqaweb.teststudio;

import com.myqaweb.feature.ProductEntity;
import com.myqaweb.feature.SegmentEntity;
import com.myqaweb.feature.SegmentRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves Claude-suggested Segment name paths ({@code List<String>}) to real Segment ID arrays
 * by walking the product's Segment tree with exact, whitespace-stripped, case-sensitive matching.
 *
 * <p>Longest-prefix matching: if {@code ["A", "B", "C"]} resolves only A and B, returns
 * {@code [A_id, B_id]} so the TC lands at the deepest valid level. If the first name fails,
 * returns {@code Long[0]}.
 *
 * <p>Duplicate sibling names under the same parent are handled deterministically: lowest id wins,
 * emits a WARN log.
 *
 * <p>NOTE: this resolver only runs when a user explicitly triggers path application. The Test Studio
 * generation pipeline must NOT inject paths automatically.
 */
@Component
@RequiredArgsConstructor
public class SegmentPathResolver {

    private static final Logger log = LoggerFactory.getLogger(SegmentPathResolver.class);
    private static final long ROOT_PARENT_KEY = -1L;

    private final SegmentRepository segmentRepository;

    /**
     * Build an in-memory lookup map for a product's segment tree. One repository call per product.
     */
    public ResolverContext buildContext(Long productId) {
        List<SegmentEntity> segments = segmentRepository.findAllByProductId(productId);
        Map<ResolverKey, SegmentEntity> lookup = new HashMap<>();

        // Sort by id asc so duplicate keys resolve deterministically to the lowest id.
        segments.stream()
                .sorted(Comparator.comparing(SegmentEntity::getId))
                .forEach(seg -> {
                    long parentKey = seg.getParent() == null ? ROOT_PARENT_KEY : seg.getParent().getId();
                    String name = seg.getName() == null ? "" : seg.getName().strip();
                    ResolverKey key = new ResolverKey(parentKey, name);
                    SegmentEntity existing = lookup.putIfAbsent(key, seg);
                    if (existing != null) {
                        log.warn("Duplicate sibling segment name — productId={}, parentKey={}, name='{}'. "
                                        + "Keeping id={}, ignoring id={}.",
                                productId, parentKey, name, existing.getId(), seg.getId());
                    }
                });

        return new ResolverContext(lookup);
    }

    /**
     * Resolve a list of segment names to the deepest matching ID prefix.
     *
     * @return a non-null Long array. Empty array when the first name doesn't match or input is null/empty.
     */
    public Long[] resolve(ResolverContext ctx, List<String> names) {
        if (ctx == null || names == null || names.isEmpty()) {
            return new Long[0];
        }

        List<Long> acc = new ArrayList<>(names.size());
        long currentParent = ROOT_PARENT_KEY;
        for (String rawName : names) {
            if (rawName == null) {
                break;
            }
            String name = rawName.strip();
            if (name.isEmpty()) {
                break;
            }
            SegmentEntity seg = ctx.lookup().get(new ResolverKey(currentParent, name));
            if (seg == null) {
                break;
            }
            acc.add(seg.getId());
            currentParent = seg.getId();
        }

        return acc.toArray(new Long[0]);
    }

    /**
     * Resolve a list of segment names to IDs, creating any missing segments along the way.
     *
     * <p>Called only when the user explicitly triggers "추천 적용" (single) or "일괄 적용"
     * (bulk). This is a user-initiated action — NOT the code-automatic injection
     * forbidden by the v2 design (which still applies to the generation pipeline).
     *
     * <p>The same {@link ResolverContext} must be shared across multiple TC resolves within
     * one Product so newly created ancestors dedup naturally:
     * <pre>
     *   TC1 suggests ["결제 실패", "네트워크 오류", "UI 렌더링"]
     *   TC2 suggests ["결제 실패", "단말기 오류", "UI 렌더링"]
     *
     *   → "결제 실패"는 한 번만 생성된다 (두 번째 TC 처리 시 lookup에서 발견).
     *   → "UI 렌더링"은 parent가 다르므로 각 parent 아래 1개씩 생성된다.
     * </pre>
     *
     * @param ctx     lookup context (mutated — new segments are added as they are created)
     * @param product owning product for newly created segments
     * @param names   path names (null/empty yields an empty path)
     * @return resolve result containing the full resolved Long[] path and the number of
     *         segments newly created by this call
     */
    public ResolveResult resolveOrCreate(ResolverContext ctx, ProductEntity product,
                                         List<String> names) {
        if (ctx == null || product == null || names == null || names.isEmpty()) {
            return new ResolveResult(new Long[0], 0);
        }

        List<Long> acc = new ArrayList<>(names.size());
        SegmentEntity currentParent = null;
        int createdCount = 0;

        for (String rawName : names) {
            if (rawName == null) break;
            String name = rawName.strip();
            if (name.isEmpty()) break;

            long parentKey = currentParent == null ? ROOT_PARENT_KEY : currentParent.getId();
            ResolverKey key = new ResolverKey(parentKey, name);
            SegmentEntity seg = ctx.lookup().get(key);
            if (seg == null) {
                SegmentEntity fresh = new SegmentEntity();
                fresh.setName(name);
                fresh.setProduct(product);
                fresh.setParent(currentParent); // null means root
                seg = segmentRepository.save(fresh);
                ctx.lookup().put(key, seg);
                createdCount++;
                log.info("Created segment on user apply: productId={}, parentId={}, name='{}', id={}",
                        product.getId(), parentKey == ROOT_PARENT_KEY ? null : parentKey,
                        name, seg.getId());
            }
            acc.add(seg.getId());
            currentParent = seg;
        }

        return new ResolveResult(acc.toArray(new Long[0]), createdCount);
    }

    /** Lookup key: (parentId, stripped name). Root segments use parentKey = -1. */
    public record ResolverKey(long parentKey, String name) {}

    /** Precomputed snapshot of a product's segment tree for efficient per-draft resolution. */
    public record ResolverContext(Map<ResolverKey, SegmentEntity> lookup) {}

    /** Result of {@link #resolveOrCreate}. {@code createdCount} counts segments saved this call. */
    public record ResolveResult(Long[] path, int createdCount) {}
}
