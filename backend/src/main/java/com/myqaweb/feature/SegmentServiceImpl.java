package com.myqaweb.feature;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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

        SegmentEntity saved = segmentRepository.save(entity);
        return toResponse(saved);
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
        segmentRepository.deleteById(id);
    }

    @Override
    public SegmentDto.SegmentResponse reparent(Long id, Long newParentId) {
        SegmentEntity entity = segmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Segment not found: " + id));

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
                entity.getParent() != null ? entity.getParent().getId() : null
        );
    }
}
