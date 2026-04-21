package com.myqaweb.knowledgebase;

import com.myqaweb.common.CategoryDto;

import java.util.List;

public interface KbCategoryService {

    List<CategoryDto.CategoryResponse> findAll();

    List<CategoryDto.CategoryResponse> search(String query);

    CategoryDto.CategoryResponse create(String name);

    void ensureExists(String name);
}
