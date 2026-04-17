package com.myqaweb.knowledgebase;

import com.myqaweb.common.ApiResponse;
import com.myqaweb.common.S3ImageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/kb/images")
public class KbImageController {

    private static final Logger log = LoggerFactory.getLogger(KbImageController.class);
    private final S3ImageService s3ImageService;

    public KbImageController(S3ImageService s3ImageService) {
        this.s3ImageService = s3ImageService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadImage(
            @RequestParam("file") MultipartFile file) {
        try {
            String imageUrl = s3ImageService.upload("kb", file);
            log.info("KB image uploaded to S3: {}", imageUrl);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.ok(Map.of("url", imageUrl)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload KB image", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("이미지 저장에 실패했습니다."));
        }
    }
}
