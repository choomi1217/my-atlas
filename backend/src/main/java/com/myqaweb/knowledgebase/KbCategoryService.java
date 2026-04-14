package com.myqaweb.knowledgebase;

import java.util.List;

public interface KbCategoryService {

    List<KbCategoryDto.CategoryResponse> findAll();

    List<KbCategoryDto.CategoryResponse> search(String query);

    KbCategoryDto.CategoryResponse create(String name);

    void ensureExists(String name);
}
