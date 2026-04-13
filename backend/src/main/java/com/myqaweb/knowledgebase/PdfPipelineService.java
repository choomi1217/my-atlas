package com.myqaweb.knowledgebase;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface PdfPipelineService {

    Long startUpload(MultipartFile file, String bookTitle, String category);

    PdfUploadJobDto.JobResponse getJob(Long jobId);

    List<PdfUploadJobDto.JobResponse> getAllJobs();

    void deleteBook(String source);
}
