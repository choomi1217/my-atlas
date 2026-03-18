package com.myqaweb.feature;

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
import static org.mockito.Mockito.*;

/**
 * Unit tests for ProductServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
class ProductServiceImplTest {
    @Mock
    private ProductRepository productRepository;

    @Mock
    private CompanyRepository companyRepository;

    @InjectMocks
    private ProductServiceImpl productService;

    private CompanyEntity company;
    private ProductEntity product1;
    private ProductEntity product2;

    @BeforeEach
    void setUp() {
        company = new CompanyEntity(1L, "Test Company", true, LocalDateTime.now());
        product1 = new ProductEntity(1L, company, "Product A", Platform.WEB, "Web app", LocalDateTime.now());
        product2 = new ProductEntity(2L, company, "Product B", Platform.MOBILE, "Mobile app", LocalDateTime.now());
    }

    @Test
    void testFindByCompanyId() {
        when(productRepository.findAllByCompanyId(1L)).thenReturn(List.of(product1, product2));

        List<ProductDto.ProductResponse> result = productService.findByCompanyId(1L);

        assertEquals(2, result.size());
        assertEquals("Product A", result.get(0).name());
        assertEquals("Product B", result.get(1).name());
        verify(productRepository).findAllByCompanyId(1L);
    }

    @Test
    void testSave() {
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company));
        when(productRepository.save(any())).thenReturn(product1);

        ProductDto.ProductResponse result = productService.save(
                new ProductDto.ProductRequest(1L, "Product A", Platform.WEB, "Web app")
        );

        assertEquals("Product A", result.name());
        assertEquals(Platform.WEB, result.platform());
        verify(productRepository).save(any());
    }

    @Test
    void testUpdate() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(product1));
        when(productRepository.save(any())).thenReturn(product1);

        ProductDto.ProductResponse result = productService.update(
                1L,
                new ProductDto.ProductRequest(1L, "Updated Product", Platform.MOBILE, "Updated description")
        );

        assertEquals("Updated Product", result.name());
        verify(productRepository).save(any());
    }

    @Test
    void testDelete() {
        productService.delete(1L);
        verify(productRepository).deleteById(1L);
    }

    @Test
    void testSaveCompanyNotFound() {
        when(companyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> productService.save(
                new ProductDto.ProductRequest(99L, "Product", Platform.WEB, "")
        ));
    }
}
