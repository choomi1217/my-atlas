package com.myqaweb.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.monitoring.AiFeature;
import com.myqaweb.monitoring.AiUsageLogService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Haiku-powered content refinement for PDF chunks.
 *
 * <p>Takes a raw section of PDFBox-extracted text and returns structured
 * Markdown chunks with meaningful/meaningless judgement. Replaces the rule-based
 * chunkText/enforceMaxSize pipeline from v6.
 *
 * <p>See {@code docs/features/knowledge-base/knowledge-base_v7.md}.
 */
@Service
@RequiredArgsConstructor
public class KbContentCleanupService {

    private static final Logger log = LoggerFactory.getLogger(KbContentCleanupService.class);

    private static final String PROVIDER = "ANTHROPIC";
    private static final String MODEL = "claude-haiku-4-5-20251001";
    private static final int MAX_TOKENS = 8192;
    private static final Float TEMPERATURE = 0.0f;

    private static final int MAX_CHUNK_CHARS = 3000;
    private static final int MIN_CHUNK_CHARS = 100;
    private static final int MAX_SECTION_CHARS = 30_000;
    private static final double MIN_RECALL_RATIO = 0.7;
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 5_000L;

    private static final String PROMPT_TEMPLATE = """
            당신은 QA 도서에서 PDFBox로 추출한 raw 텍스트를 Markdown 청크로 재구성하는 편집자입니다.

            입력 특성:
            - 한국어 어절이 깨짐 ("조 정하여" → "조정하여")
            - 문단 경계 유실, 줄바꿈이 물리적 줄끝
            - 불릿 마크(●, ▪, •, 1) 2))가 공백으로 유실됨
            - 본문 중간에 페이지 푸터가 껴있음

            요구사항:
            1. 출력: JSON 배열만. 각 원소는 { "title", "markdown", "meaningful": bool, "reason" }
            2. 주제 일관 단위(500~1500자)로 나누되, 입력이 짧으면 1개만 출력해도 됨
            3. 깨진 한국어 어절을 자연스럽게 붙이고, 문장 끝(. ! ?)에서 줄바꿈
            4. 번호/불릿은 Markdown 리스트(1. / -)로 복원
            5. 핵심 용어는 **볼드**
            6. 페이지 푸터 제거
            7. ❗ 원문 의미 변경·요약·삭제 금지. 포맷만 정리. 모든 정보 보존.
            8. meaningful 판정:
               - false: 목차 dot-leaders / UI 조작만 / 깨져서 해석 불가 / 페이지 번호 잔해
               - true: 테스트 기법·원칙·학습목표·용어 정의 등 QA 실무 지식
            9. JSON 배열만 출력. 설명 금지.

            === 원문 (도서: %s / 섹션: %s) ===
            %s
            === 끝 ===
            """;

    private final ChatClient chatClient;
    private final AiUsageLogService aiUsageLogService;
    private final ObjectMapper objectMapper;

    /**
     * Refines a raw section text into Markdown chunks via Claude Haiku.
     *
     * @param bookTitle   parent book title (for prompt context + logging)
     * @param sectionName section header (may be null for pre-first-chapter content)
     * @param content     raw section content
     * @return list of refined chunks; empty list if refinement fails unrecoverably
     */
    public List<RefinedChunk> refine(String bookTitle, String sectionName, String content) {
        if (content == null || content.isBlank()) {
            return List.of();
        }
        if (content.length() > MAX_SECTION_CHARS) {
            return refineLargeSection(bookTitle, sectionName, content);
        }
        List<RefinedChunk> refined = callWithRetry(bookTitle, sectionName, content);
        return applySafetyRails(refined);
    }

    private List<RefinedChunk> callWithRetry(String bookTitle, String sectionName, String content) {
        int attempt = 0;
        while (attempt < MAX_RETRIES) {
            attempt++;
            long start = System.currentTimeMillis();
            Integer inputTokens = null;
            Integer outputTokens = null;
            boolean success = false;
            String errorMessage = null;
            try {
                AnthropicChatOptions options = AnthropicChatOptions.builder()
                        .withMaxTokens(MAX_TOKENS)
                        .withTemperature(TEMPERATURE)
                        .build();
                String prompt = PROMPT_TEMPLATE.formatted(
                        safe(bookTitle), safe(sectionName), content);
                ChatResponse chatResponse = chatClient.prompt()
                        .user(prompt)
                        .options(options)
                        .call()
                        .chatResponse();

                Usage usage = chatResponse.getMetadata() != null
                        ? chatResponse.getMetadata().getUsage() : null;
                if (usage != null) {
                    inputTokens = usage.getPromptTokens() != null ? usage.getPromptTokens().intValue() : null;
                    outputTokens = usage.getGenerationTokens() != null ? usage.getGenerationTokens().intValue() : null;
                }

                String raw = chatResponse.getResult().getOutput().getContent();
                List<RefinedChunk> parsed = parseJson(raw);
                if (parsed.isEmpty()) {
                    errorMessage = "JSON parse failed or empty array";
                    throw new IllegalStateException(errorMessage);
                }

                int totalLen = parsed.stream()
                        .mapToInt(c -> c.markdown() == null ? 0 : c.markdown().length())
                        .sum();
                if (totalLen < content.length() * MIN_RECALL_RATIO) {
                    errorMessage = "Output too short (%d < %.0f%% of input %d)".formatted(
                            totalLen, MIN_RECALL_RATIO * 100, content.length());
                    throw new IllegalStateException(errorMessage);
                }

                success = true;
                return parsed;
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                errorMessage = msg;
                boolean rateLimited = msg.contains("429");
                log.warn("Cleanup attempt {}/{} failed (book='{}', section='{}'): {}",
                        attempt, MAX_RETRIES, bookTitle, sectionName, msg);
                if (rateLimited && attempt < MAX_RETRIES) {
                    sleepQuiet(RETRY_DELAY_MS);
                }
            } finally {
                long duration = System.currentTimeMillis() - start;
                aiUsageLogService.logUsage(AiFeature.PDF_CLEANUP, PROVIDER, MODEL,
                        inputTokens, outputTokens, duration, success, errorMessage);
            }
        }
        log.warn("Cleanup giving up after {} attempts (book='{}', section='{}')",
                MAX_RETRIES, bookTitle, sectionName);
        return List.of();
    }

    private List<RefinedChunk> refineLargeSection(String bookTitle, String sectionName, String content) {
        List<RefinedChunk> result = new ArrayList<>();
        String[] paragraphs = content.split("\\n\\n+");
        StringBuilder buffer = new StringBuilder();
        for (String para : paragraphs) {
            if (buffer.length() + para.length() + 2 > MAX_SECTION_CHARS && buffer.length() > 0) {
                List<RefinedChunk> chunks = callWithRetry(bookTitle, sectionName, buffer.toString());
                result.addAll(applySafetyRails(chunks));
                buffer.setLength(0);
            }
            if (buffer.length() > 0) buffer.append("\n\n");
            buffer.append(para);
        }
        if (buffer.length() > 0) {
            List<RefinedChunk> chunks = callWithRetry(bookTitle, sectionName, buffer.toString());
            result.addAll(applySafetyRails(chunks));
        }
        return result;
    }

    // --- Safety rails ---

    List<RefinedChunk> applySafetyRails(List<RefinedChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) return List.of();
        List<RefinedChunk> sized = new ArrayList<>();
        for (RefinedChunk chunk : chunks) {
            if (chunk == null || chunk.markdown() == null) continue;
            if (chunk.markdown().length() > MAX_CHUNK_CHARS) {
                sized.addAll(splitOversized(chunk));
            } else {
                sized.add(chunk);
            }
        }
        return mergeUndersized(sized);
    }

    private List<RefinedChunk> splitOversized(RefinedChunk chunk) {
        List<RefinedChunk> out = new ArrayList<>();
        String md = chunk.markdown();
        String baseTitle = chunk.title() != null ? chunk.title() : "chunk";
        int part = 1;
        int start = 0;
        while (start < md.length()) {
            int end = Math.min(md.length(), start + MAX_CHUNK_CHARS);
            if (end < md.length()) {
                int ws = md.lastIndexOf(' ', end);
                if (ws > start + MAX_CHUNK_CHARS / 2) end = ws;
            }
            String slice = md.substring(start, end);
            out.add(new RefinedChunk(
                    baseTitle + " (part " + part + ")",
                    slice,
                    chunk.meaningful(),
                    chunk.reason()));
            part++;
            start = end;
        }
        return out;
    }

    private List<RefinedChunk> mergeUndersized(List<RefinedChunk> chunks) {
        if (chunks.size() <= 1) return chunks;
        List<RefinedChunk> result = new ArrayList<>();
        for (RefinedChunk chunk : chunks) {
            if (chunk.markdown().length() < MIN_CHUNK_CHARS && !result.isEmpty()) {
                RefinedChunk prev = result.removeLast();
                result.add(new RefinedChunk(
                        prev.title(),
                        prev.markdown() + "\n\n" + chunk.markdown(),
                        prev.meaningful() || chunk.meaningful(),
                        prev.reason()));
            } else {
                result.add(chunk);
            }
        }
        return result;
    }

    // --- JSON parsing ---

    List<RefinedChunk> parseJson(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        String json = extractJsonArray(raw.trim());
        if (json == null) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<RefinedChunk>>() {});
        } catch (Exception primary) {
            String recovered = truncateToLastCompleteObject(json);
            if (recovered == null) {
                log.warn("JSON parse failed, no recovery possible: {}", primary.getMessage());
                return List.of();
            }
            try {
                List<RefinedChunk> partial = objectMapper.readValue(recovered,
                        new TypeReference<List<RefinedChunk>>() {});
                log.warn("Claude response truncated — recovered {} complete chunks", partial.size());
                return partial;
            } catch (Exception secondary) {
                log.warn("JSON parse failed even after truncation recovery: {}", secondary.getMessage());
                return List.of();
            }
        }
    }

    private String extractJsonArray(String raw) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start == -1) return null;
        if (end == -1 || end <= start) return raw.substring(start);
        return raw.substring(start, end + 1);
    }

    String truncateToLastCompleteObject(String jsonStr) {
        if (jsonStr == null || jsonStr.length() < 2 || jsonStr.charAt(0) != '[') return null;
        int depth = 0;
        boolean inString = false;
        boolean escape = false;
        int lastClose = -1;
        for (int i = 1; i < jsonStr.length(); i++) {
            char c = jsonStr.charAt(i);
            if (escape) { escape = false; continue; }
            if (c == '\\') { escape = true; continue; }
            if (c == '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) lastClose = i;
            }
        }
        if (lastClose <= 0) return null;
        return jsonStr.substring(0, lastClose + 1) + "]";
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private static void sleepQuiet(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RefinedChunk(String title, String markdown, boolean meaningful, String reason) {}
}
