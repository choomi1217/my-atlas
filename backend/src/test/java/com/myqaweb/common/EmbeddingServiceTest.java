package com.myqaweb.common;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingResponse;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Unit tests for EmbeddingService.
 */
@ExtendWith(MockitoExtension.class)
class EmbeddingServiceTest {

    @Mock
    private EmbeddingModel embeddingModel;

    @InjectMocks
    private EmbeddingService embeddingService;

    // --- embed ---

    @Test
    void embed_callsModelAndReturnsOutput() {
        // Arrange
        List<Double> outputDoubles = List.of(0.1, 0.2, 0.3);
        float[] expectedEmbedding = {0.1f, 0.2f, 0.3f};
        Embedding mockEmbedding = mock(Embedding.class);
        doReturn(outputDoubles).when(mockEmbedding).getOutput();

        EmbeddingResponse mockResponse = mock(EmbeddingResponse.class);
        doReturn(mockEmbedding).when(mockResponse).getResult();
        when(embeddingModel.embedForResponse(anyList())).thenReturn(mockResponse);

        // Act
        float[] result = embeddingService.embed("test text");

        // Assert
        assertArrayEquals(expectedEmbedding, result, 0.001f);
        verify(embeddingModel).embedForResponse(List.of("test text"));
    }

    @Test
    void embed_propagatesExceptionFromModel() {
        // Arrange
        when(embeddingModel.embedForResponse(anyList()))
                .thenThrow(new RuntimeException("Model unavailable"));

        // Act & Assert
        assertThrows(RuntimeException.class, () -> embeddingService.embed("text"));
    }

    // --- toVectorString ---

    @Test
    void toVectorString_convertsFloatArrayToString() {
        // Arrange
        float[] embedding = {0.1f, 0.2f, 0.3f};

        // Act
        String result = embeddingService.toVectorString(embedding);

        // Assert
        assertEquals("[0.1,0.2,0.3]", result);
    }

    @Test
    void toVectorString_handlesSingleElement() {
        // Arrange
        float[] embedding = {1.5f};

        // Act
        String result = embeddingService.toVectorString(embedding);

        // Assert
        assertEquals("[1.5]", result);
    }

    @Test
    void toVectorString_handlesEmptyArray() {
        // Arrange
        float[] embedding = {};

        // Act
        String result = embeddingService.toVectorString(embedding);

        // Assert
        assertEquals("[]", result);
    }

    @Test
    void toVectorString_handlesNegativeValues() {
        // Arrange
        float[] embedding = {-0.5f, 0.0f, 1.0f};

        // Act
        String result = embeddingService.toVectorString(embedding);

        // Assert
        assertEquals("[-0.5,0.0,1.0]", result);
    }
}
