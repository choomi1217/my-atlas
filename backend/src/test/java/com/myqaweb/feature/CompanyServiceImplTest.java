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
 * Unit tests for CompanyServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
class CompanyServiceImplTest {
    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private CompanyServiceImpl companyService;

    private CompanyEntity company1;
    private CompanyEntity company2;

    @BeforeEach
    void setUp() {
        company1 = new CompanyEntity(1L, "Company A", false, LocalDateTime.now());
        company2 = new CompanyEntity(2L, "Company B", true, LocalDateTime.now());
    }

    @Test
    void testFindAll() {
        when(companyRepository.findAll()).thenReturn(List.of(company1, company2));
        when(productRepository.countByCompanyId(1L)).thenReturn(2);
        when(productRepository.countByCompanyId(2L)).thenReturn(3);

        List<CompanyDto.CompanyResponse> result = companyService.findAll();

        assertEquals(2, result.size());
        assertEquals("Company A", result.get(0).name());
        assertEquals(2, result.get(0).productCount());
        assertEquals("Company B", result.get(1).name());
        assertEquals(3, result.get(1).productCount());
        verify(companyRepository).findAll();
    }

    @Test
    void testSave() {
        CompanyEntity savedEntity = new CompanyEntity(1L, "New Company", false, LocalDateTime.now());
        when(companyRepository.save(any())).thenReturn(savedEntity);
        when(productRepository.countByCompanyId(1L)).thenReturn(0);

        CompanyDto.CompanyResponse result = companyService.save(new CompanyDto.CompanyRequest("New Company"));

        assertNotNull(result);
        assertEquals("New Company", result.name());
        assertFalse(result.isActive());
        assertEquals(0, result.productCount());
        verify(companyRepository).save(any());
    }

    @Test
    void testSetActive() {
        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.of(company2));
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company1));
        when(companyRepository.save(any())).thenReturn(company1);
        when(productRepository.countByCompanyId(anyLong())).thenReturn(0);

        CompanyDto.CompanyResponse result = companyService.setActive(1L);

        assertEquals("Company A", result.name());
        assertTrue(result.isActive());
        verify(companyRepository, times(2)).save(any());
    }

    @Test
    void testDelete() {
        companyService.delete(1L);
        verify(companyRepository).deleteById(1L);
    }

    @Test
    void testSetActiveNotFound() {
        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.empty());
        when(companyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> companyService.setActive(99L));
    }

    // --- update tests ---

    @Test
    void testUpdate_success() {
        CompanyEntity updated = new CompanyEntity(1L, "Updated Name", false, LocalDateTime.now());
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company1));
        when(companyRepository.save(any())).thenReturn(updated);
        when(productRepository.countByCompanyId(1L)).thenReturn(2);

        CompanyDto.CompanyResponse result = companyService.update(1L, new CompanyDto.CompanyRequest("Updated Name"));

        assertEquals("Updated Name", result.name());
        assertEquals(2, result.productCount());
        verify(companyRepository).findById(1L);
        verify(companyRepository).save(any());
    }

    @Test
    void testUpdate_throwsWhenNotFound() {
        when(companyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> companyService.update(99L, new CompanyDto.CompanyRequest("Name")));
        verify(companyRepository, never()).save(any());
    }

    // --- deactivate tests ---

    @Test
    void testDeactivate_success() {
        CompanyEntity activeCompany = new CompanyEntity(2L, "Company B", true, LocalDateTime.now());
        CompanyEntity deactivated = new CompanyEntity(2L, "Company B", false, LocalDateTime.now());
        when(companyRepository.findById(2L)).thenReturn(Optional.of(activeCompany));
        when(companyRepository.save(any())).thenReturn(deactivated);
        when(productRepository.countByCompanyId(2L)).thenReturn(1);

        CompanyDto.CompanyResponse result = companyService.deactivate(2L);

        assertFalse(result.isActive());
        assertEquals("Company B", result.name());
        assertEquals(1, result.productCount());
        verify(companyRepository).findById(2L);
        verify(companyRepository).save(any());
    }

    @Test
    void testDeactivate_throwsWhenNotFound() {
        when(companyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> companyService.deactivate(99L));
        verify(companyRepository, never()).save(any());
    }

    // --- toResponse includes productCount ---

    @Test
    void testToResponse_includesProductCount() {
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company1));
        when(productRepository.countByCompanyId(1L)).thenReturn(5);

        Optional<CompanyDto.CompanyResponse> result = companyService.findById(1L);

        assertTrue(result.isPresent());
        assertEquals(5, result.get().productCount());
    }
}
