package com.myqaweb.feature;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.ai.embedding.Embedding;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Unit tests for FeatureServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
class FeatureServiceImplTest {
    @Mock
    private FeatureRepository featureRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private EmbeddingModel embeddingModel;

    @InjectMocks
    private FeatureServiceImpl featureService;

    private CompanyEntity company;
    private ProductEntity product;
    private FeatureEntity feature;

    @BeforeEach
    void setUp() {
        company = new CompanyEntity(1L, "Test Company", true, LocalDateTime.now());
        product = new ProductEntity(1L, company, "Product A", Platform.WEB, "Web app", LocalDateTime.now());
        feature = new FeatureEntity(
                1L, product, "Main › Login", "Social Login",
                "Social login feature", "Allow users to login with social accounts",
                new float[1536], LocalDateTime.now(), LocalDateTime.now()
        );
        // Enable embedding for tests
        ReflectionTestUtils.setField(featureService, "embeddingEnabled", true);
    }

    @Test
    void testFindByProductId() {
        when(featureRepository.findAllByProductId(1L)).thenReturn(List.of(feature));

        List<FeatureDto.FeatureResponse> result = featureService.findByProductId(1L);

        assertEquals(1, result.size());
        assertEquals("Social Login", result.get(0).name());
        verify(featureRepository).findAllByProductId(1L);
    }

    @Test
    void testSaveWithEmbedding() {
        // Mock EmbeddingModel to return List<Double> (actual return type from Spring AI)
        List<Double> mockEmbeddingList = new java.util.ArrayList<>();
        for (int i = 0; i < 1536; i++) {
            mockEmbeddingList.add(0.1);
        }

        EmbeddingResponse mockResponse = mock(EmbeddingResponse.class);
        Embedding mockEmbeddingObj = mock(Embedding.class);
        when(mockEmbeddingObj.getOutput()).thenReturn(mockEmbeddingList);
        when(mockResponse.getResult()).thenReturn(mockEmbeddingObj);
        when(embeddingModel.call(any(EmbeddingRequest.class))).thenReturn(mockResponse);

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(featureRepository.save(any())).thenReturn(feature);

        FeatureDto.FeatureResponse result = featureService.saveWithEmbedding(
                new FeatureDto.FeatureRequest(
                        1L, "Main › Login", "Social Login",
                        "Social login feature", "Allow users to login with social accounts"
                )
        );

        assertNotNull(result);
        verify(embeddingModel).call(any(EmbeddingRequest.class));
        verify(featureRepository).save(any());
    }

    @Test
    void testUpdate() {
        List<Double> mockEmbeddingList = new java.util.ArrayList<>();
        for (int i = 0; i < 1536; i++) {
            mockEmbeddingList.add(0.1);
        }

        EmbeddingResponse mockResponse = mock(EmbeddingResponse.class);
        Embedding mockEmbeddingObj = mock(Embedding.class);
        when(mockEmbeddingObj.getOutput()).thenReturn(mockEmbeddingList);
        when(mockResponse.getResult()).thenReturn(mockEmbeddingObj);
        when(embeddingModel.call(any(EmbeddingRequest.class))).thenReturn(mockResponse);

        when(featureRepository.findById(1L)).thenReturn(Optional.of(feature));
        when(featureRepository.save(any())).thenReturn(feature);

        FeatureDto.FeatureResponse result = featureService.update(
                1L,
                new FeatureDto.FeatureRequest(
                        1L, "Main › Login", "Updated Login",
                        "Updated feature", "Updated prompt"
                )
        );

        assertEquals("Updated Login", result.name());
        verify(embeddingModel).call(any(EmbeddingRequest.class));
        verify(featureRepository).save(any());
    }

    @Test
    void testDelete() {
        featureService.delete(1L);
        verify(featureRepository).deleteById(1L);
    }

    @Test
    void testSaveWithEmbeddingProductNotFound() {
        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> featureService.saveWithEmbedding(
                new FeatureDto.FeatureRequest(99L, "path", "name", "desc", "prompt")
        ));
    }

    @Test
    void testSearchSimilar() {
        // Note: searchSimilar is a placeholder - returns empty list
        // Embedding similarity search requires pgvector integration
        List<FeatureDto.FeatureResponse> result = featureService.searchSimilar("social login", 5);

        assertEquals(0, result.size());
    }
}
