package com.myqaweb.knowledgebase;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/kb")
@RequiredArgsConstructor
public class KnowledgeBaseController {

    private final KnowledgeBaseService knowledgeBaseService;
    private final PdfPipelineService pdfPipelineService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<KnowledgeBaseDto.KbResponse>>> list() {
        List<KnowledgeBaseDto.KbResponse> items = knowledgeBaseService.findAll();
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<KnowledgeBaseDto.KbResponse>> getById(@PathVariable Long id) {
        return knowledgeBaseService.findById(id)
                .map(kb -> ResponseEntity.ok(ApiResponse.ok(kb)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Knowledge Base entry not found")));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<KnowledgeBaseDto.KbResponse>> create(
            @Valid @RequestBody KnowledgeBaseDto.KbRequest request) {
        KnowledgeBaseDto.KbResponse created = knowledgeBaseService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Knowledge Base entry created", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<KnowledgeBaseDto.KbResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody KnowledgeBaseDto.KbRequest request) {
        KnowledgeBaseDto.KbResponse updated = knowledgeBaseService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Knowledge Base entry updated", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        knowledgeBaseService.delete(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Knowledge Base entry deleted", null));
    }

    // --- PDF Upload Pipeline Endpoints ---

    @PostMapping("/upload-pdf")
    public ResponseEntity<ApiResponse<Map<String, Long>>> uploadPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam("bookTitle") String bookTitle) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File is empty"));
        }
        Long jobId = pdfPipelineService.startUpload(file, bookTitle);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("PDF upload started", Map.of("jobId", jobId)));
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<ApiResponse<PdfUploadJobDto.JobResponse>> getJob(@PathVariable Long jobId) {
        PdfUploadJobDto.JobResponse job = pdfPipelineService.getJob(jobId);
        return ResponseEntity.ok(ApiResponse.ok(job));
    }

    @GetMapping("/jobs")
    public ResponseEntity<ApiResponse<List<PdfUploadJobDto.JobResponse>>> getAllJobs() {
        List<PdfUploadJobDto.JobResponse> jobs = pdfPipelineService.getAllJobs();
        return ResponseEntity.ok(ApiResponse.ok(jobs));
    }

    @DeleteMapping("/books/{source}")
    public ResponseEntity<ApiResponse<Void>> deleteBook(@PathVariable String source) {
        pdfPipelineService.deleteBook(source);
        return ResponseEntity.ok(new ApiResponse<>(true, "Book and all chunks deleted", null));
    }
}
