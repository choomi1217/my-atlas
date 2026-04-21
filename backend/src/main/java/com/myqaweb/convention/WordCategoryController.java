package com.myqaweb.convention;

import com.myqaweb.common.ApiResponse;
import com.myqaweb.common.CategoryDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conventions/categories")
@RequiredArgsConstructor
public class WordCategoryController {

    private final WordCategoryService categoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryDto.CategoryResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.ok(categoryService.findAll()));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<CategoryDto.CategoryResponse>>> search(
            @RequestParam(value = "q", required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(ApiResponse.ok(categoryService.search(query)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryDto.CategoryResponse>> create(
            @Valid @RequestBody CategoryDto.CategoryRequest request) {
        CategoryDto.CategoryResponse created = categoryService.create(request.name());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Category created", created));
    }
}
