package com.myqaweb.feature;

import com.myqaweb.common.BaseIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for Company activation mutex using real database.
 * Verifies that only one company can be active at a time.
 */
@Transactional
class CompanyActivationIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private CompanyService companyService;

    @BeforeEach
    void setUp() {
        companyRepository.deleteAll();
    }

    @Test
    void setActive_firstActivation_succeeds() {
        // Arrange
        CompanyEntity company = new CompanyEntity();
        company.setName("Corp A");
        company.setIsActive(false);
        CompanyEntity saved = companyRepository.save(company);

        // Act
        CompanyDto.CompanyResponse result = companyService.setActive(saved.getId());

        // Assert
        assertTrue(result.isActive());
        assertEquals("Corp A", result.name());
    }

    @Test
    void setActive_deactivatesPreviousAndActivatesNew() {
        // Arrange
        CompanyEntity companyA = new CompanyEntity();
        companyA.setName("Corp A");
        companyA.setIsActive(false);
        CompanyEntity savedA = companyRepository.save(companyA);

        CompanyEntity companyB = new CompanyEntity();
        companyB.setName("Corp B");
        companyB.setIsActive(false);
        CompanyEntity savedB = companyRepository.save(companyB);

        // Activate A first
        companyService.setActive(savedA.getId());

        // Act — activate B (should deactivate A)
        CompanyDto.CompanyResponse result = companyService.setActive(savedB.getId());

        // Assert
        assertTrue(result.isActive());

        CompanyEntity refreshedA = companyRepository.findById(savedA.getId()).orElseThrow();
        assertFalse(refreshedA.getIsActive(), "Previous active company should be deactivated");

        CompanyEntity refreshedB = companyRepository.findById(savedB.getId()).orElseThrow();
        assertTrue(refreshedB.getIsActive(), "New company should be active");
    }

    @Test
    void findByIsActiveTrue_returnsOnlyOneCompany() {
        // Arrange
        for (int i = 1; i <= 3; i++) {
            CompanyEntity company = new CompanyEntity();
            company.setName("Corp " + i);
            company.setIsActive(false);
            companyRepository.save(company);
        }

        List<CompanyEntity> all = companyRepository.findAll();
        companyService.setActive(all.get(1).getId());

        // Act
        Optional<CompanyEntity> active = companyRepository.findByIsActiveTrue();

        // Assert
        assertTrue(active.isPresent());
        assertEquals("Corp 2", active.get().getName());

        long activeCount = companyRepository.findAll().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .count();
        assertEquals(1, activeCount, "Only one company should be active");
    }
}
