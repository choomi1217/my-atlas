package com.myqaweb.feature;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SegmentServiceImplTest {
    @Mock
    private SegmentRepository segmentRepository;

    @Mock
    private ProductRepository productRepository;

    private SegmentServiceImpl segmentService;

    private CompanyEntity company;
    private ProductEntity product;
    private SegmentEntity rootSegment;
    private SegmentEntity childSegment;

    @BeforeEach
    void setUp() {
        segmentService = new SegmentServiceImpl(segmentRepository, productRepository);

        company = new CompanyEntity(1L, "Test Company", true, LocalDateTime.now());
        product = new ProductEntity(1L, company, "Product A", Platform.WEB, "Web app", LocalDateTime.now());
        rootSegment = new SegmentEntity(1L, "Main", product, null);
        childSegment = new SegmentEntity(2L, "Login", product, rootSegment);
    }

    @Test
    void testFindByProductId() {
        when(segmentRepository.findAllByProductId(1L)).thenReturn(List.of(rootSegment, childSegment));

        List<SegmentDto.SegmentResponse> result = segmentService.findByProductId(1L);

        assertEquals(2, result.size());
        assertEquals("Main", result.get(0).name());
        assertNull(result.get(0).parentId());
        assertEquals("Login", result.get(1).name());
        assertEquals(1L, result.get(1).parentId());
        verify(segmentRepository).findAllByProductId(1L);
    }

    @Test
    void testCreateRootSegment() {
        SegmentDto.SegmentRequest request = new SegmentDto.SegmentRequest(1L, "Main", null);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(segmentRepository.save(any())).thenReturn(rootSegment);

        SegmentDto.SegmentResponse result = segmentService.create(request);

        assertEquals("Main", result.name());
        assertNull(result.parentId());
        verify(productRepository).findById(1L);
        verify(segmentRepository).save(any());
    }

    @Test
    void testCreateChildSegment() {
        SegmentDto.SegmentRequest request = new SegmentDto.SegmentRequest(1L, "Login", 1L);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        when(segmentRepository.save(any())).thenReturn(childSegment);

        SegmentDto.SegmentResponse result = segmentService.create(request);

        assertEquals("Login", result.name());
        assertEquals(1L, result.parentId());
    }

    @Test
    void testCreateProductNotFound() {
        SegmentDto.SegmentRequest request = new SegmentDto.SegmentRequest(99L, "Main", null);

        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> segmentService.create(request));
    }

    @Test
    void testCreateParentFromDifferentProduct() {
        ProductEntity otherProduct = new ProductEntity(2L, company, "Other", Platform.WEB, "Other", LocalDateTime.now());
        SegmentEntity otherSegment = new SegmentEntity(10L, "Other Root", otherProduct, null);

        SegmentDto.SegmentRequest request = new SegmentDto.SegmentRequest(1L, "Child", 10L);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(segmentRepository.findById(10L)).thenReturn(Optional.of(otherSegment));

        assertThrows(IllegalArgumentException.class, () -> segmentService.create(request));
    }

    @Test
    void testUpdate() {
        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        SegmentEntity updatedSegment = new SegmentEntity(1L, "Main Page", product, null);
        when(segmentRepository.save(any())).thenReturn(updatedSegment);

        SegmentDto.SegmentResponse result = segmentService.update(1L, "Main Page");

        assertEquals("Main Page", result.name());
    }

    @Test
    void testDelete() {
        segmentService.delete(1L);
        verify(segmentRepository).deleteById(1L);
    }

    @Test
    void testReparentSuccess() {
        SegmentEntity newRoot = new SegmentEntity(3L, "New Root", product, null);
        SegmentEntity reparentedRoot = new SegmentEntity(1L, "Main", product, newRoot);

        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        when(segmentRepository.findById(3L)).thenReturn(Optional.of(newRoot));
        when(segmentRepository.save(any())).thenReturn(reparentedRoot);

        SegmentDto.SegmentResponse result = segmentService.reparent(1L, 3L);

        assertEquals(1L, result.id());
        assertEquals(3L, result.parentId());
        verify(segmentRepository).save(any());
    }

    @Test
    void testReparentToNull() {
        when(segmentRepository.findById(2L)).thenReturn(Optional.of(childSegment));
        SegmentEntity madeRoot = new SegmentEntity(2L, "Login", product, null);
        when(segmentRepository.save(any())).thenReturn(madeRoot);

        SegmentDto.SegmentResponse result = segmentService.reparent(2L, null);

        assertNull(result.parentId());
        verify(segmentRepository).save(any());
    }

    @Test
    void testReparentSegmentNotFound() {
        when(segmentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> segmentService.reparent(99L, 1L));
    }

    @Test
    void testReparentParentNotFound() {
        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        when(segmentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> segmentService.reparent(1L, 99L));
    }

    @Test
    void testReparentDifferentProduct() {
        ProductEntity otherProduct = new ProductEntity(2L, company, "Other", Platform.WEB, "Other", LocalDateTime.now());
        SegmentEntity otherSegment = new SegmentEntity(10L, "Other Root", otherProduct, null);

        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        when(segmentRepository.findById(10L)).thenReturn(Optional.of(otherSegment));

        assertThrows(IllegalArgumentException.class, () -> segmentService.reparent(1L, 10L));
    }
}
