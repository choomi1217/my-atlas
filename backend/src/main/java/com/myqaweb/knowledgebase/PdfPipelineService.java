package com.myqaweb.knowledgebase;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Service interface for PDF upload pipeline operations.
 */
public interface PdfPipelineService {

    /**
     * Starts a PDF upload and processing job.
     *
     * @param file      the PDF file
     * @param bookTitle the book title for labeling chunks
     * @return the created job ID
     */
    Long startUpload(MultipartFile file, String bookTitle);

    /**
     * Gets the status of a specific upload job.
     */
    PdfUploadJobDto.JobResponse getJob(Long jobId);

    /**
     * Gets all upload jobs.
     */
    List<PdfUploadJobDto.JobResponse> getAllJobs();

    /**
     * Deletes all chunks for a specific book and its job records.
     */
    void deleteBook(String source);
}
