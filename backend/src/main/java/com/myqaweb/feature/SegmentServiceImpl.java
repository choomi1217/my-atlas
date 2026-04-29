package com.myqaweb.feature;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Queue;
import java.util.LinkedList;
import java.util.stream.Collectors;

/**
 * Service implementation for Segment operations.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SegmentServiceImpl implements SegmentService {
    private final SegmentRepository segmentRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional(readOnly = true)
    public List<SegmentDto.SegmentResponse> findByProductId(Long productId) {
        return segmentRepository.findAllByProductId(productId)
                .stream()
                .sorted(
                        Comparator
                                .comparing((SegmentEntity s) -> s.getParent() == null ? -1L : s.getParent().getId())
                                .thenComparing(SegmentEntity::getOrderIndex)
                                .thenComparing(SegmentEntity::getId)
                )
                .map(this::toResponse)
                .toList();
    }

    @Override
    public SegmentDto.SegmentResponse create(SegmentDto.SegmentRequest request) {
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + request.productId()));

        SegmentEntity entity = new SegmentEntity();
        entity.setName(request.name());
        entity.setProduct(product);

        if (request.parentId() != null) {
            SegmentEntity parent = segmentRepository.findById(request.parentId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent segment not found: " + request.parentId()));

            if (!parent.getProduct().getId().equals(request.productId())) {
                throw new IllegalArgumentException("Parent segment does not belong to the same product");
            }
            entity.setParent(parent);
        }

        // Append to end of sibling group: orderIndex = max(orderIndex) + 1, or 0 if empty
        Integer maxOrder = segmentRepository.findMaxOrderIndex(request.productId(), request.parentId());
        entity.setOrderIndex(maxOrder + 1);

        SegmentEntity saved = segmentRepository.save(entity);
        return toResponse(saved);
    }

    @Override
    public void reorder(SegmentDto.ReorderRequest request) {
        List<SegmentEntity> segments = segmentRepository.findAllById(request.segmentIds());
        if (segments.size() != request.segmentIds().size()) {
            throw new IllegalArgumentException("Some segments not found");
        }

        // All segments must belong to the same (productId, parentId) group
        for (SegmentEntity s : segments) {
            if (!s.getProduct().getId().equals(request.productId())) {
                throw new IllegalArgumentException(
                        "Segment " + s.getId() + " is not in product " + request.productId());
            }
            Long actualParentId = s.getParent() != null ? s.getParent().getId() : null;
            if (!Objects.equals(actualParentId, request.parentId())) {
                throw new IllegalArgumentException(
                        "Segment " + s.getId() + " is not in the requested parent group");
            }
        }

        Map<Long, SegmentEntity> byId = segments.stream()
                .collect(Collectors.toMap(SegmentEntity::getId, s -> s));

        for (int i = 0; i < request.segmentIds().size(); i++) {
            SegmentEntity s = byId.get(request.segmentIds().get(i));
            s.setOrderIndex(i);
        }
        segmentRepository.saveAll(segments);
    }

    @Override
    public SegmentDto.SegmentResponse update(Long id, String name) {
        SegmentEntity entity = segmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Segment not found: " + id));

        entity.setName(name);
        SegmentEntity updated = segmentRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        SegmentEntity entity = segmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Segment not found: " + id));

        // Guard: cannot delete the last root segment in a product (would leave product without any path)
        if (entity.getParent() == null) {
            long rootCount = segmentRepository.countByProductIdAndParentIsNull(
                    entity.getProduct().getId());
            if (rootCount <= 1) {
                throw new IllegalArgumentException(
                        "Cannot delete the last root segment in this product");
            }
        }

        segmentRepository.deleteById(id);
    }

    @Override
    public void validateReparent(Long segmentId, Long newParentId) {
        // Case 1: newParentId is null, which is always valid (making segment root)
        if (newParentId == null) {
            return;
        }

        // Case 2: newParentId is the same as segmentId (cannot be self-parent)
        if (newParentId.equals(segmentId)) {
            throw new IllegalArgumentException("Cannot set a segment as its own parent");
        }

        // Case 3: newParentId is a descendant of segmentId (circular reference)
        if (isDescendant(segmentId, newParentId)) {
            throw new IllegalArgumentException("Cannot set a descendant segment as parent (circular reference)");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isDescendant(Long segmentId, Long potentialDescendantId) {
        // BFS to find all descendants of segmentId
        Queue<Long> queue = new LinkedList<>();
        queue.add(segmentId);

        while (!queue.isEmpty()) {
            Long current = queue.poll();
            List<SegmentEntity> children = segmentRepository.findAllByParentId(current);
            for (SegmentEntity child : children) {
                if (child.getId().equals(potentialDescendantId)) {
                    return true;
                }
                queue.add(child.getId());
            }
        }
        return false;
    }

    @Override
    public SegmentDto.SegmentResponse reparent(Long id, Long newParentId) {
        SegmentEntity entity = segmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Segment not found: " + id));

        // Validate circular references and constraints
        validateReparent(id, newParentId);

        if (newParentId != null) {
            SegmentEntity newParent = segmentRepository.findById(newParentId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent segment not found: " + newParentId));

            if (!newParent.getProduct().getId().equals(entity.getProduct().getId())) {
                throw new IllegalArgumentException("Parent segment does not belong to the same product");
            }
            entity.setParent(newParent);
        } else {
            entity.setParent(null);
        }

        SegmentEntity updated = segmentRepository.save(entity);
        return toResponse(updated);
    }

    private SegmentDto.SegmentResponse toResponse(SegmentEntity entity) {
        return new SegmentDto.SegmentResponse(
                entity.getId(),
                entity.getName(),
                entity.getProduct().getId(),
                entity.getParent() != null ? entity.getParent().getId() : null,
                entity.getOrderIndex()
        );
    }
}
