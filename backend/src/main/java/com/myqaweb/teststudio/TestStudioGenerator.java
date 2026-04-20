package com.myqaweb.teststudio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.EmbeddingService;
import com.myqaweb.convention.ConventionEntity;
import com.myqaweb.convention.ConventionRepository;
import com.myqaweb.feature.Priority;
import com.myqaweb.feature.ProductEntity;
import com.myqaweb.feature.ProductRepository;
import com.myqaweb.feature.TestCaseEntity;
import com.myqaweb.feature.TestCaseRepository;
import com.myqaweb.feature.TestStatus;
import com.myqaweb.feature.TestStep;
import com.myqaweb.feature.TestType;
import com.myqaweb.knowledgebase.KnowledgeBaseEntity;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import com.myqaweb.monitoring.AiFeature;
import com.myqaweb.monitoring.AiUsageLogService;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Async generator for Test Studio DRAFT TCs.
 *
 * <p>Separated from {@link TestStudioServiceImpl} so that Spring's {@code @Async} proxy works
 * correctly (self-invocation bypasses proxies). Mirrors the
 * {@link com.myqaweb.knowledgebase.PdfProcessingWorker} pattern.
 *
 * <p>Pipeline:
 * <ol>
 *     <li>Extract source text (MD passthrough or PDFBox).</li>
 *     <li>Build RAG context: KB top-5 (vector) + Convention full list + TC top-5.</li>
 *     <li>Render prompt and call Claude via {@link ChatClient}.</li>
 *     <li>Parse JSON array response to {@link DraftTestCaseDto} list.</li>
 *     <li>Persist each draft as {@link TestCaseEntity} with status=DRAFT.</li>
 *     <li>Update job status (DONE / FAILED) and completedAt.</li>
 * </ol>
 */
@Component
@RequiredArgsConstructor
public class TestStudioGenerator {

    private static final Logger log = LoggerFactory.getLogger(TestStudioGenerator.class);

    private static final int RAG_QUERY_CHAR_LIMIT = 2000;
    private static final int KB_TOP_K = 5;
    private static final int TC_TOP_K = 5;
    private static final String PROVIDER = "ANTHROPIC";
    private static final String MODEL = "claude-haiku-4-5-20251001";

    private final TestStudioJobRepository jobRepository;
    private final AiUsageLogService aiUsageLogService;
    private final KnowledgeBaseRepository kbRepository;
    private final ConventionRepository conventionRepository;
    private final TestCaseRepository testCaseRepository;
    private final ProductRepository productRepository;
    private final EmbeddingService embeddingService;
    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    /**
     * Async entry point — runs the entire generation pipeline.
     *
     * @param jobId           persisted job id (already in PENDING state)
     * @param productId       target product id
     * @param sourceType      MARKDOWN or PDF
     * @param markdownContent non-null when sourceType=MARKDOWN
     * @param pdfBytes        non-null when sourceType=PDF
     */
    @Async
    public void generate(Long jobId, Long productId, SourceType sourceType,
                         String markdownContent, byte[] pdfBytes) {
        TestStudioJobEntity job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("Test Studio job not found: {}", jobId);
            return;
        }

        job.setStatus(TestStudioJobStatus.PROCESSING);
        jobRepository.save(job);

        try {
            // 1. Extract text
            String sourceText = sourceType == SourceType.PDF
                    ? extractPdfText(pdfBytes)
                    : markdownContent;

            if (sourceText == null || sourceText.isBlank()) {
                throw new IllegalStateException("원본 문서에서 텍스트를 추출할 수 없습니다.");
            }

            ProductEntity product = productRepository.findById(productId)
                    .orElseThrow(() -> new IllegalStateException("Product not found: " + productId));

            // 2. Build RAG context
            String kbContext = buildKbContext(sourceText);
            String conventionContext = buildConventionContext();
            String tcContext = buildExistingTcContext(productId);

            // 3. Build prompt
            String prompt = buildPrompt(product.getName(), sourceText, kbContext,
                    conventionContext, tcContext);

            log.info("Test Studio calling Claude: jobId={}, sourceLen={} chars", jobId, sourceText.length());

            // 4. Call Claude — override max-tokens for this call only.
            // Default (application.yml) is 2048 which truncates multi-TC JSON mid-string.
            // Claude 3.5 Sonnet supports up to 8192 output tokens.
            AnthropicChatOptions options = AnthropicChatOptions.builder()
                    .withMaxTokens(8192)
                    .build();
            long chatStartMs = System.currentTimeMillis();
            ChatResponse chatResponse = chatClient.prompt().user(prompt).options(options).call().chatResponse();
            long chatDurationMs = System.currentTimeMillis() - chatStartMs;
            String response = chatResponse.getResult().getOutput().getContent();
            log.info("Test Studio Claude response received: jobId={}, responseLen={} chars",
                    jobId, response == null ? 0 : response.length());

            // Log AI usage
            Usage usage = chatResponse.getMetadata() != null ? chatResponse.getMetadata().getUsage() : null;
            if (usage != null) {
                aiUsageLogService.logUsage(AiFeature.TEST_STUDIO, PROVIDER, MODEL,
                        usage.getPromptTokens().intValue(), usage.getGenerationTokens().intValue(),
                        chatDurationMs, true, null);
            }

            // 5. Parse JSON array
            List<DraftTestCaseDto> drafts = parseDrafts(response);

            if (drafts.isEmpty()) {
                log.warn("Test Studio job {} produced zero drafts", jobId);
                job.setStatus(TestStudioJobStatus.FAILED);
                job.setErrorMessage("JSON 배열 파싱 실패 — 생성된 TC 없음");
                job.setCompletedAt(LocalDateTime.now());
                jobRepository.save(job);
                return;
            }

            // 6. Persist drafts as DRAFT TCs
            int savedCount = 0;
            for (DraftTestCaseDto draft : drafts) {
                try {
                    TestCaseEntity tc = toTestCaseEntity(draft, product, jobId);
                    testCaseRepository.save(tc);
                    savedCount++;
                    log.info("Test Studio saved DRAFT TC: jobId={}, title='{}'", jobId, tc.getTitle());
                } catch (Exception e) {
                    log.warn("Test Studio failed to save a draft (jobId={}): {}", jobId, e.getMessage());
                }
            }

            // 7. Mark done (even partial success is DONE per spec)
            job.setStatus(TestStudioJobStatus.DONE);
            job.setGeneratedCount(savedCount);
            job.setCompletedAt(LocalDateTime.now());
            jobRepository.save(job);

            log.info("Test Studio job completed: jobId={}, generated={}", jobId, savedCount);

        } catch (Exception e) {
            log.error("Test Studio job failed: jobId={}", jobId, e);
            job.setStatus(TestStudioJobStatus.FAILED);
            job.setErrorMessage(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
            job.setCompletedAt(LocalDateTime.now());
            jobRepository.save(job);
        }
    }

    // --- RAG context builders ---

    private String buildKbContext(String sourceText) {
        try {
            String queryText = sourceText.length() > RAG_QUERY_CHAR_LIMIT
                    ? sourceText.substring(0, RAG_QUERY_CHAR_LIMIT)
                    : sourceText;
            float[] embedding = embeddingService.embed(queryText, AiFeature.EMBEDDING_TEST_STUDIO);
            String vectorStr = embeddingService.toVectorString(embedding);
            List<KnowledgeBaseEntity> top = kbRepository.findSimilar(vectorStr, KB_TOP_K);
            if (top.isEmpty()) {
                return "(관련 지식 베이스 없음)";
            }
            return top.stream()
                    .map(kb -> "- " + safe(kb.getTitle()) + ": " + truncate(safe(kb.getContent()), 400))
                    .collect(Collectors.joining("\n"));
        } catch (Exception e) {
            log.warn("KB RAG context build failed (continuing without): {}", e.getMessage());
            return "(관련 지식 베이스 조회 실패)";
        }
    }

    private String buildConventionContext() {
        try {
            List<ConventionEntity> conventions = conventionRepository.findAll();
            if (conventions.isEmpty()) {
                return "(등록된 용어 컨벤션 없음)";
            }
            return conventions.stream()
                    .map(c -> "- " + safe(c.getTerm()) + ": " + safe(c.getDefinition()))
                    .collect(Collectors.joining("\n"));
        } catch (Exception e) {
            log.warn("Convention context build failed: {}", e.getMessage());
            return "(용어 컨벤션 조회 실패)";
        }
    }

    private String buildExistingTcContext(Long productId) {
        try {
            List<TestCaseEntity> tcs = testCaseRepository.findAllByProductId(productId);
            if (tcs.isEmpty()) {
                return "(기존 TC 없음)";
            }
            return tcs.stream()
                    .limit(TC_TOP_K)
                    .map(tc -> {
                        String stepsSummary = tc.getSteps() == null || tc.getSteps().isEmpty()
                                ? ""
                                : tc.getSteps().stream()
                                        .limit(2)
                                        .map(s -> s.action() + " → " + s.expected())
                                        .collect(Collectors.joining("; "));
                        return "- " + safe(tc.getTitle())
                                + (stepsSummary.isEmpty() ? "" : " | Steps: " + truncate(stepsSummary, 200))
                                + (tc.getExpectedResult() != null
                                        ? " | Expected: " + truncate(safe(tc.getExpectedResult()), 200)
                                        : "");
                    })
                    .collect(Collectors.joining("\n"));
        } catch (Exception e) {
            log.warn("Existing TC context build failed: {}", e.getMessage());
            return "(기존 TC 조회 실패)";
        }
    }

    // --- Prompt builder ---

    private String buildPrompt(String productName, String sourceText,
                               String kbContext, String conventionContext, String tcContext) {
        return """
                [System]
                당신은 시니어 QA이다. 주어진 문서를 바탕으로 테스트 케이스를 JSON 배열로 생성한다.
                팀의 용어 컨벤션과 기존 TC 패턴(제목 prefix, Steps 구조 등)을 반드시 반영하라.
                예외/실패 케이스(네트워크 오류, 입력값 검증 실패, 타임아웃 등)도 최소 1건 이상 포함하라.

                [Product]
                %s

                [Context: Domain Knowledge — Top %d KB chunks]
                %s

                [Context: Word Convention]
                %s

                [Context: Existing TC Patterns — up to %d TCs]
                %s

                [Input Document]
                %s

                [Output Schema]
                아래 JSON 배열 형식으로만 응답하라. 다른 텍스트/설명은 포함하지 말 것.
                [
                  {
                    "title": string,
                    "preconditions": string,
                    "steps": [ { "order": number, "action": string, "expected": string } ],
                    "expectedResult": string,
                    "priority": "HIGH" | "MEDIUM" | "LOW",
                    "testType": "SMOKE" | "FUNCTIONAL" | "REGRESSION" | "E2E",
                    "suggestedSegmentPath": [ string, ... ]
                  }
                ]
                """.formatted(productName, KB_TOP_K, kbContext, conventionContext, TC_TOP_K, tcContext, sourceText);
    }

    // --- Response parsing ---

    List<DraftTestCaseDto> parseDrafts(String response) {
        if (response == null || response.isBlank()) {
            return List.of();
        }
        String jsonStr = extractJsonArray(response.trim());
        if (jsonStr == null) {
            log.warn("No JSON array bracket found in Claude response");
            return List.of();
        }
        // First pass — try as-is.
        try {
            return objectMapper.readValue(
                    jsonStr,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, DraftTestCaseDto.class)
            );
        } catch (Exception primary) {
            // Claude response was likely truncated (max_tokens hit mid-object).
            // Recover by trimming to the last TOP-LEVEL complete "}" and re-closing the array.
            String recovered = truncateToLastCompleteObject(jsonStr);
            if (recovered == null) {
                log.warn("Failed to parse DRAFT TC list from Claude response (no recovery possible)", primary);
                return List.of();
            }
            try {
                List<DraftTestCaseDto> partial = objectMapper.readValue(
                        recovered,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, DraftTestCaseDto.class)
                );
                log.warn("Claude response was truncated — recovered {} complete draft(s) from partial JSON",
                        partial.size());
                return partial;
            } catch (Exception secondary) {
                log.warn("Failed to parse DRAFT TC list even after truncation recovery", secondary);
                return List.of();
            }
        }
    }

    /**
     * Extract the JSON array substring from a raw Claude response, handling
     * code-fenced output and leading commentary. Returns {@code null} if no array bracket is found.
     */
    private String extractJsonArray(String raw) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start == -1) return null;
        if (end == -1 || end <= start) {
            // Truncated before the closing bracket — return from '[' to end.
            return raw.substring(start);
        }
        return raw.substring(start, end + 1);
    }

    /**
     * If a JSON array was truncated mid-object, trim to the last top-level
     * {@code "}"} and close with {@code "]"} so Jackson can still parse the
     * complete prefix. Returns {@code null} if no complete object exists.
     */
    String truncateToLastCompleteObject(String jsonStr) {
        if (jsonStr == null || jsonStr.length() < 2 || jsonStr.charAt(0) != '[') {
            return null;
        }
        int depth = 0;
        boolean inString = false;
        boolean escape = false;
        int lastTopLevelClose = -1;
        for (int i = 1; i < jsonStr.length(); i++) {
            char c = jsonStr.charAt(i);
            if (escape) { escape = false; continue; }
            if (c == '\\') { escape = true; continue; }
            if (c == '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) lastTopLevelClose = i;
            }
        }
        if (lastTopLevelClose <= 0) return null;
        return jsonStr.substring(0, lastTopLevelClose + 1) + "]";
    }

    // --- Draft → TestCaseEntity ---

    private TestCaseEntity toTestCaseEntity(DraftTestCaseDto draft, ProductEntity product, Long jobId) {
        TestCaseEntity tc = new TestCaseEntity();
        tc.setProduct(product);
        tc.setPath(new Long[0]); // v1: user manually selects segments later
        tc.setTitle(draft.title() != null ? draft.title() : "Untitled DRAFT");
        tc.setPreconditions(draft.preconditions());
        tc.setSteps(draft.steps() != null ? draft.steps() : new ArrayList<TestStep>());
        tc.setExpectedResult(draft.expectedResult());
        tc.setPriority(draft.priority() != null ? draft.priority() : Priority.MEDIUM);
        tc.setTestType(draft.testType() != null ? draft.testType() : TestType.FUNCTIONAL);
        tc.setStatus(TestStatus.DRAFT);
        tc.setTestStudioJobId(jobId);
        return tc;
    }

    // --- Helpers ---

    private String extractPdfText(byte[] pdfBytes) {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (Exception e) {
            throw new IllegalStateException("PDF 텍스트 추출 실패: " + e.getMessage(), e);
        }
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "…";
    }
}
