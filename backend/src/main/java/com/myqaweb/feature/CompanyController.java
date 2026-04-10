package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Company endpoints.
 */
@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
public class CompanyController {
    private final CompanyService companyService;

    /**
     * GET /api/companies - List all companies.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<CompanyDto.CompanyResponse>>> listAll() {
        List<CompanyDto.CompanyResponse> companies = companyService.findAll();
        return ResponseEntity.ok(ApiResponse.ok(companies));
    }

    /**
     * POST /api/companies - Create a new company.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<CompanyDto.CompanyResponse>> create(
            @Valid @RequestBody CompanyDto.CompanyRequest request) {
        CompanyDto.CompanyResponse company = companyService.save(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Company created successfully", company));
    }

    /**
     * PATCH /api/companies/{id}/activate - Set company as active.
     */
    @PatchMapping("/{id}/activate")
    public ResponseEntity<ApiResponse<CompanyDto.CompanyResponse>> activate(@PathVariable Long id) {
        CompanyDto.CompanyResponse company = companyService.setActive(id);
        return ResponseEntity.ok(ApiResponse.ok("Company activated", company));
    }

    /**
     * PUT /api/companies/{id} - Update company name.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CompanyDto.CompanyResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody CompanyDto.CompanyRequest request) {
        CompanyDto.CompanyResponse company = companyService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Company updated", company));
    }

    /**
     * PATCH /api/companies/{id}/deactivate - Deactivate a company.
     */
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<ApiResponse<CompanyDto.CompanyResponse>> deactivate(@PathVariable Long id) {
        CompanyDto.CompanyResponse company = companyService.deactivate(id);
        return ResponseEntity.ok(ApiResponse.ok("Company deactivated", company));
    }

    /**
     * DELETE /api/companies/{id} - Delete a company.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        companyService.delete(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Company deleted successfully", null));
    }
}
