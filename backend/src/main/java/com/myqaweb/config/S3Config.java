package com.myqaweb.config;

import com.myqaweb.common.ImageService;
import com.myqaweb.common.LocalImageService;
import com.myqaweb.common.S3ImageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.nio.file.Path;

@Configuration
public class S3Config implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(S3Config.class);

    @Value("${app.s3.region:ap-northeast-2}")
    private String region;

    @Value("${app.s3.access-key:}")
    private String accessKey;

    @Value("${app.s3.secret-key:}")
    private String secretKey;

    @Value("${app.s3.image-bucket:my-atlas-images}")
    private String bucketName;

    private boolean isS3Enabled() {
        return !accessKey.isBlank() && !secretKey.isBlank();
    }

    @Bean
    public ImageService imageService() {
        if (isS3Enabled()) {
            log.info("S3 credentials detected — using S3ImageService (bucket: {})", bucketName);
            S3Client s3Client = S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKey, secretKey)))
                    .build();
            return new S3ImageService(s3Client, bucketName);
        } else {
            log.info("No S3 credentials — using LocalImageService (uploads/images/)");
            return new LocalImageService(Path.of("uploads", "images"));
        }
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        if (!isS3Enabled()) {
            registry.addResourceHandler("/images/**")
                    .addResourceLocations("file:uploads/images/");
        }
    }
}
