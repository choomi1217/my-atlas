package com.myqaweb.knowledgebase;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PdfUploadJobRepository extends JpaRepository<PdfUploadJobEntity, Long> {

    List<PdfUploadJobEntity> findByBookTitle(String bookTitle);

    void deleteByBookTitle(String bookTitle);
}
