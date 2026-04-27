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
import static org.mockito.ArgumentMatchers.anyList;
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
        product = new ProductEntity(1L, company, "Product A", Platform.WEB, "Web app", null, LocalDateTime.now());
        rootSegment = new SegmentEntity(1L, "Main", product, null, 0);
        childSegment = new SegmentEntity(2L, "Login", product, rootSegment, 0);
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
        ProductEntity otherProduct = new ProductEntity(2L, company, "Other", Platform.WEB, "Other", null, LocalDateTime.now());
        SegmentEntity otherSegment = new SegmentEntity(10L, "Other Root", otherProduct, null, 0);

        SegmentDto.SegmentRequest request = new SegmentDto.SegmentRequest(1L, "Child", 10L);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(segmentRepository.findById(10L)).thenReturn(Optional.of(otherSegment));

        assertThrows(IllegalArgumentException.class, () -> segmentService.create(request));
    }

    @Test
    void testUpdate() {
        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        SegmentEntity updatedSegment = new SegmentEntity(1L, "Main Page", product, null, 0);
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
        SegmentEntity newRoot = new SegmentEntity(3L, "New Root", product, null, 0);
        SegmentEntity reparentedRoot = new SegmentEntity(1L, "Main", product, newRoot, 0);

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
        SegmentEntity madeRoot = new SegmentEntity(2L, "Login", product, null, 0);
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
        ProductEntity otherProduct = new ProductEntity(2L, company, "Other", Platform.WEB, "Other", null, LocalDateTime.now());
        SegmentEntity otherSegment = new SegmentEntity(10L, "Other Root", otherProduct, null, 0);

        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        when(segmentRepository.findById(10L)).thenReturn(Optional.of(otherSegment));

        assertThrows(IllegalArgumentException.class, () -> segmentService.reparent(1L, 10L));
    }

    // --- Circular Reference Tests ---

    @Test
    void testReparentSelfAsParent() {
        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));

        assertThrows(IllegalArgumentException.class, () -> segmentService.reparent(1L, 1L));
    }

    @Test
    void testReparentCircularReference_ChildAsParent() {
        // childSegment has rootSegment as parent
        // Try to set childSegment as parent of rootSegment (circular)
        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        when(segmentRepository.findAllByParentId(1L)).thenReturn(List.of(childSegment));

        assertThrows(IllegalArgumentException.class, () -> segmentService.reparent(1L, 2L));
    }

    @Test
    void testReparentCircularReference_GrandchildAsParent() {
        // Try to set grandchild as parent of root (circular)
        SegmentEntity grandchild = new SegmentEntity(3L, "FB Auth", product, childSegment, 0);

        when(segmentRepository.findById(1L)).thenReturn(Optional.of(rootSegment));
        when(segmentRepository.findAllByParentId(1L)).thenReturn(List.of(childSegment));
        when(segmentRepository.findAllByParentId(2L)).thenReturn(List.of(grandchild));

        assertThrows(IllegalArgumentException.class, () -> segmentService.reparent(1L, 3L));
    }

    @Test
    void testIsDescendant_True() {
        SegmentEntity grandchild = new SegmentEntity(3L, "FB Auth", product, childSegment, 0);

        when(segmentRepository.findAllByParentId(1L)).thenReturn(List.of(childSegment));
        when(segmentRepository.findAllByParentId(2L)).thenReturn(List.of(grandchild));

        // Both calls should work with the same mock setup
        assertTrue(segmentService.isDescendant(1L, 2L)); // Direct child
        assertTrue(segmentService.isDescendant(1L, 3L)); // Grandchild
    }

    @Test
    void testIsDescendant_False() {
        when(segmentRepository.findAllByParentId(1L)).thenReturn(List.of(childSegment));
        when(segmentRepository.findAllByParentId(2L)).thenReturn(List.of()); // No children under child

        assertFalse(segmentService.isDescendant(1L, 99L));
    }

    @Test
    void testValidateReparent_NullIsValid() {
        // Should not throw
        segmentService.validateReparent(1L, null);
    }

    @Test
    void testValidateReparent_SelfFails() {
        assertThrows(IllegalArgumentException.class, () -> segmentService.validateReparent(1L, 1L));
    }

    @Test
    void testValidateReparent_DescendantFails() {
        when(segmentRepository.findAllByParentId(1L)).thenReturn(List.of(childSegment));

        assertThrows(IllegalArgumentException.class, () -> segmentService.validateReparent(1L, 2L));
    }

    // --- orderIndex / reorder ---

    @Test
    void create_setsOrderIndexFromMaxPlusOne() {
        when(productRepository.findById(1L)).thenReturn(java.util.Optional.of(product));
        when(segmentRepository.findMaxOrderIndex(1L, null)).thenReturn(2);
        when(segmentRepository.save(any(SegmentEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        SegmentDto.SegmentRequest request = new SegmentDto.SegmentRequest(1L, "FAQ", null);
        segmentService.create(request);

        org.mockito.ArgumentCaptor<SegmentEntity> captor =
                org.mockito.ArgumentCaptor.forClass(SegmentEntity.class);
        verify(segmentRepository).save(captor.capture());
        assertEquals(3, captor.getValue().getOrderIndex());
    }

    @Test
    void create_firstRootInProduct_orderIndexIsZero() {
        when(productRepository.findById(1L)).thenReturn(java.util.Optional.of(product));
        when(segmentRepository.findMaxOrderIndex(1L, null)).thenReturn(-1);
        when(segmentRepository.save(any(SegmentEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        segmentService.create(new SegmentDto.SegmentRequest(1L, "First Root", null));

        org.mockito.ArgumentCaptor<SegmentEntity> captor =
                org.mockito.ArgumentCaptor.forClass(SegmentEntity.class);
        verify(segmentRepository).save(captor.capture());
        assertEquals(0, captor.getValue().getOrderIndex());
    }

    @Test
    void reorder_assignsOrderIndexInRequestedOrder() {
        SegmentEntity s1 = new SegmentEntity(10L, "A", product, null, 5);
        SegmentEntity s2 = new SegmentEntity(20L, "B", product, null, 7);
        SegmentEntity s3 = new SegmentEntity(30L, "C", product, null, 9);
        when(segmentRepository.findAllById(java.util.List.of(30L, 10L, 20L)))
                .thenReturn(java.util.List.of(s1, s2, s3));

        segmentService.reorder(new SegmentDto.ReorderRequest(1L, null,
                java.util.List.of(30L, 10L, 20L)));

        assertEquals(1, s1.getOrderIndex());  // A is now at position 1
        assertEquals(2, s2.getOrderIndex());  // B is now at position 2
        assertEquals(0, s3.getOrderIndex());  // C is now at position 0
        verify(segmentRepository).saveAll(anyList());
    }

    @Test
    void reorder_throwsWhenSegmentBelongsToDifferentProduct() {
        ProductEntity otherProduct = new ProductEntity(99L, company, "Other", Platform.WEB,
                "desc", null, LocalDateTime.now());
        SegmentEntity s = new SegmentEntity(10L, "X", otherProduct, null, 0);
        when(segmentRepository.findAllById(java.util.List.of(10L))).thenReturn(java.util.List.of(s));

        assertThrows(IllegalArgumentException.class, () ->
                segmentService.reorder(new SegmentDto.ReorderRequest(1L, null, java.util.List.of(10L))));
        verify(segmentRepository, never()).saveAll(anyList());
    }

    @Test
    void reorder_throwsWhenSegmentHasDifferentParent() {
        SegmentEntity otherParent = new SegmentEntity(99L, "OtherParent", product, null, 0);
        SegmentEntity s = new SegmentEntity(10L, "X", product, otherParent, 0);
        when(segmentRepository.findAllById(java.util.List.of(10L))).thenReturn(java.util.List.of(s));

        // Request specifies parentId = null, but segment's actual parent is 99L → mismatch
        assertThrows(IllegalArgumentException.class, () ->
                segmentService.reorder(new SegmentDto.ReorderRequest(1L, null, java.util.List.of(10L))));
        verify(segmentRepository, never()).saveAll(anyList());
    }

    @Test
    void reorder_throwsWhenSomeSegmentIdMissing() {
        when(segmentRepository.findAllById(java.util.List.of(99L))).thenReturn(java.util.List.of());

        assertThrows(IllegalArgumentException.class, () ->
                segmentService.reorder(new SegmentDto.ReorderRequest(1L, null, java.util.List.of(99L))));
    }
}
