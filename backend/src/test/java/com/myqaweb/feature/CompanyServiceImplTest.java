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

        List<CompanyDto.CompanyResponse> result = companyService.findAll();

        assertEquals(2, result.size());
        assertEquals("Company A", result.get(0).name());
        assertEquals("Company B", result.get(1).name());
        verify(companyRepository).findAll();
    }

    @Test
    void testSave() {
        CompanyEntity savedEntity = new CompanyEntity(1L, "New Company", false, LocalDateTime.now());
        when(companyRepository.save(any())).thenReturn(savedEntity);

        CompanyDto.CompanyResponse result = companyService.save(new CompanyDto.CompanyRequest("New Company"));

        assertNotNull(result);
        assertEquals("New Company", result.name());
        assertFalse(result.isActive());
        verify(companyRepository).save(any());
    }

    @Test
    void testSetActive() {
        CompanyEntity activeCompany = new CompanyEntity(2L, "Company B", true, LocalDateTime.now());
        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.of(company2));
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company1));
        when(companyRepository.save(any())).thenReturn(company1);

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
}
