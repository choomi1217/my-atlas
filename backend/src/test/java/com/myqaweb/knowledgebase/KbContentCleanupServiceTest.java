package com.myqaweb.knowledgebase;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.monitoring.AiFeature;
import com.myqaweb.monitoring.AiUsageLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link KbContentCleanupService}.
 *
 * <p>Verifies JSON parsing (happy path, truncation recovery), safety rails
 * (oversized split, undersized merge), and AI usage monitoring integration.
 */
@ExtendWith(MockitoExtension.class)
class KbContentCleanupServiceTest {

    @Mock private ChatClient chatClient;
    @Mock private AiUsageLogService aiUsageLogService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private KbContentCleanupService service;

    @BeforeEach
    void setUp() {
        service = new KbContentCleanupService(chatClient, aiUsageLogService, objectMapper);
    }

    // --- JSON parsing ---

    @Test
    void parseJson_parsesValidArray() {
        String raw = """
                [
                  {"title": "t1", "markdown": "content1", "meaningful": true, "reason": "r1"},
                  {"title": "t2", "markdown": "content2", "meaningful": false, "reason": "r2"}
                ]""";

        List<KbContentCleanupService.RefinedChunk> result = service.parseJson(raw);

        assertEquals(2, result.size());
        assertEquals("t1", result.get(0).title());
        assertTrue(result.get(0).meaningful());
        assertFalse(result.get(1).meaningful());
    }

    @Test
    void parseJson_handlesCodeFencedResponse() {
        String raw = """
                ```json
                [{"title": "t", "markdown": "md", "meaningful": true, "reason": "r"}]
                ```""";

        List<KbContentCleanupService.RefinedChunk> result = service.parseJson(raw);

        assertEquals(1, result.size());
        assertEquals("t", result.get(0).title());
    }

    @Test
    void parseJson_returnsEmptyForBlank() {
        assertEquals(0, service.parseJson("").size());
        assertEquals(0, service.parseJson(null).size());
    }

    @Test
    void parseJson_returnsEmptyWhenNoArrayBracket() {
        assertEquals(0, service.parseJson("no json here").size());
    }

    @Test
    void parseJson_recoversFromTruncation() {
        // Truncated mid-object: first object complete, second cut off
        String raw = """
                [
                  {"title": "t1", "markdown": "full", "meaningful": true, "reason": "r1"},
                  {"title": "t2", "markdown": "half""";

        List<KbContentCleanupService.RefinedChunk> result = service.parseJson(raw);

        assertEquals(1, result.size(), "Should recover the 1 complete object");
        assertEquals("t1", result.get(0).title());
    }

    @Test
    void truncateToLastCompleteObject_findsLastClosingBrace() {
        String raw = """
                [{"a":"b"},{"c":"d"},{"e":""";
        String recovered = service.truncateToLastCompleteObject(raw);

        assertNotNull(recovered);
        assertTrue(recovered.endsWith("]"));
        assertTrue(recovered.contains("\"c\":\"d\""));
    }

    @Test
    void truncateToLastCompleteObject_handlesEscapedQuotesInString() {
        String raw = "[{\"md\":\"say \\\"hi\\\"\"},{\"md\":\"b";
        String recovered = service.truncateToLastCompleteObject(raw);

        assertNotNull(recovered);
        assertTrue(recovered.endsWith("]"));
    }

    @Test
    void truncateToLastCompleteObject_returnsNullWhenNoCompleteObject() {
        assertNull(service.truncateToLastCompleteObject("[{\"a\":\"partial"));
        assertNull(service.truncateToLastCompleteObject(""));
        assertNull(service.truncateToLastCompleteObject(null));
    }

    // --- Safety rails: oversized split ---

    @Test
    void applySafetyRails_splitsOversizedChunks() {
        String huge = "a".repeat(5000);
        List<KbContentCleanupService.RefinedChunk> input = List.of(
                new KbContentCleanupService.RefinedChunk("big", huge, true, "r"));

        List<KbContentCleanupService.RefinedChunk> result = service.applySafetyRails(input);

        assertTrue(result.size() >= 2, "Oversized chunk should be split into 2+ parts");
        for (KbContentCleanupService.RefinedChunk chunk : result) {
            assertTrue(chunk.markdown().length() <= 3100,
                    "Each part should be at or near 3000 chars: " + chunk.markdown().length());
        }
    }

    @Test
    void applySafetyRails_preservesNormalSizedChunks() {
        List<KbContentCleanupService.RefinedChunk> input = List.of(
                new KbContentCleanupService.RefinedChunk("t1", "a".repeat(500), true, "r1"),
                new KbContentCleanupService.RefinedChunk("t2", "b".repeat(1500), true, "r2"));

        List<KbContentCleanupService.RefinedChunk> result = service.applySafetyRails(input);

        assertEquals(2, result.size(), "Normal-sized chunks should pass through unchanged");
    }

    // --- Safety rails: undersized merge ---

    @Test
    void applySafetyRails_mergesUndersizedChunkIntoPrevious() {
        List<KbContentCleanupService.RefinedChunk> input = List.of(
                new KbContentCleanupService.RefinedChunk("t1", "a".repeat(500), true, "r1"),
                new KbContentCleanupService.RefinedChunk("t2", "tiny", true, "r2"));

        List<KbContentCleanupService.RefinedChunk> result = service.applySafetyRails(input);

        assertEquals(1, result.size(), "Tiny chunk should merge into previous");
        assertTrue(result.get(0).markdown().contains("tiny"));
        assertTrue(result.get(0).markdown().contains("aaa"));
    }

    @Test
    void applySafetyRails_keepsFirstChunkEvenIfTiny() {
        // First chunk is tiny but has nothing to merge backwards to — keep it
        List<KbContentCleanupService.RefinedChunk> input = List.of(
                new KbContentCleanupService.RefinedChunk("t1", "small", true, "r1"));

        List<KbContentCleanupService.RefinedChunk> result = service.applySafetyRails(input);

        assertEquals(1, result.size());
        assertEquals("small", result.get(0).markdown());
    }

    @Test
    void applySafetyRails_handlesEmptyInput() {
        assertEquals(0, service.applySafetyRails(List.of()).size());
        assertEquals(0, service.applySafetyRails(null).size());
    }

    @Test
    void applySafetyRails_skipsNullEntries() {
        List<KbContentCleanupService.RefinedChunk> input = new java.util.ArrayList<>();
        input.add(null);
        input.add(new KbContentCleanupService.RefinedChunk("t", "content here " .repeat(50), true, "r"));

        List<KbContentCleanupService.RefinedChunk> result = service.applySafetyRails(input);

        assertEquals(1, result.size());
    }

    // --- End-to-end refine() with mocked ChatClient ---

    @Test
    void refine_logsUsageOnSuccess() {
        String content = "a".repeat(200);
        String claudeOutput = """
                [{"title":"t","markdown":"%s","meaningful":true,"reason":"ok"}]
                """.formatted("a".repeat(200));
        mockChatClientResponse(claudeOutput, 100, 50);

        List<KbContentCleanupService.RefinedChunk> result = service.refine("Book", "Section", content);

        assertEquals(1, result.size());
        verify(aiUsageLogService, times(1)).logUsage(
                eq(AiFeature.PDF_CLEANUP), eq("ANTHROPIC"), eq("claude-haiku-4-5-20251001"),
                eq(100), eq(50), anyLong(), eq(true), eq(null));
    }

    @Test
    void refine_retriesOnParseFailureAndLogsEachAttempt() {
        // Returns invalid JSON — triggers retry path.
        mockChatClientResponse("not json at all", 50, 10);

        List<KbContentCleanupService.RefinedChunk> result = service.refine("Book", "Section", "content here");

        assertTrue(result.isEmpty(), "Unrecoverable parse failure returns empty");
        // Each of the 3 attempts logs usage with success=false
        verify(aiUsageLogService, times(3)).logUsage(
                eq(AiFeature.PDF_CLEANUP), anyString(), anyString(),
                any(), any(), anyLong(), eq(false), anyString());
    }

    @Test
    void refine_returnsEmptyForBlankContent() {
        List<KbContentCleanupService.RefinedChunk> result = service.refine("Book", "Section", "   ");

        assertTrue(result.isEmpty());
        verify(aiUsageLogService, never()).logUsage(
                any(), anyString(), anyString(), any(), any(), anyLong(), anyBoolean(), any());
    }

    @Test
    void refine_detectsRecallTruncation() {
        // Input 2000 chars but output only 500 chars — should trigger "output too short" retry
        String content = "a".repeat(2000);
        String shortOutput = """
                [{"title":"t","markdown":"short","meaningful":true,"reason":"r"}]
                """;
        mockChatClientResponse(shortOutput, 100, 10);

        List<KbContentCleanupService.RefinedChunk> result = service.refine("Book", "Section", content);

        // All 3 attempts fail because output length ratio < 70%
        assertTrue(result.isEmpty());
        verify(aiUsageLogService, times(3)).logUsage(
                any(), anyString(), anyString(), any(), any(), anyLong(), eq(false), anyString());
    }

    // --- Helpers ---

    private void mockChatClientResponse(String responseText, int inputTokens, int outputTokens) {
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.CallResponseSpec callSpec =
                mock(ChatClient.ChatClientRequest.CallResponseSpec.class);

        Generation generation = new Generation(responseText);
        Usage usage = mock(Usage.class);
        lenient().when(usage.getPromptTokens()).thenReturn((long) inputTokens);
        lenient().when(usage.getGenerationTokens()).thenReturn((long) outputTokens);
        ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
        lenient().when(metadata.getUsage()).thenReturn(usage);
        ChatResponse chatResponse = new ChatResponse(List.of(generation), metadata);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.options(any(ChatOptions.class))).thenReturn(clientRequest);
        when(clientRequest.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(chatResponse);
    }
}
