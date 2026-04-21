package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import com.myqaweb.common.ImageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Shared image upload controller for Feature Registry domain.
 * Used by TestCase images and TestResult comment images.
 */
@RestController
@RequestMapping("/api/feature-images")
public class FeatureImageController {

    private static final Logger log = LoggerFactory.getLogger(FeatureImageController.class);
    private final ImageService imageService;

    public FeatureImageController(ImageService imageService) {
        this.imageService = imageService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadImage(
            @RequestParam("file") MultipartFile file) {
        try {
            String imageUrl = imageService.upload("feature", file);
            String filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
            log.info("Feature image uploaded: {}", imageUrl);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.ok(Map.of(
                            "url", imageUrl,
                            "filename", filename,
                            "originalName", file.getOriginalFilename() != null ? file.getOriginalFilename() : filename
                    )));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload feature image", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to save image."));
        }
    }
}
