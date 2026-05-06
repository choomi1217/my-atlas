package com.myqaweb.senior;

import com.myqaweb.common.EmbeddingService;
import com.myqaweb.common.SlackNotificationService;
import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import com.myqaweb.knowledgebase.KnowledgeBaseEntity;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import com.myqaweb.knowledgebase.KnowledgeBaseService;
import com.myqaweb.monitoring.AiFeature;
import com.myqaweb.monitoring.AiUsageLogService;
import com.myqaweb.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Implementation of SeniorService.
 * Handles RAG pipeline for AI chat and curated FAQ view (KB-based).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SeniorServiceImpl implements SeniorService {

    private static final Logger log = LoggerFactory.getLogger(SeniorServiceImpl.class);
    private static final int KB_MANUAL_TOP_K = 3;
    private static final int KB_PDF_TOP_K = 2;

    private static final String PROVIDER = "ANTHROPIC";
    private static final String MODEL = "claude-haiku-4-5-20251001";

    private final ChatClient chatClient;
    private final EmbeddingService embeddingService;
    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final KnowledgeBaseService knowledgeBaseService;
    private final ChatSessionService chatSessionService;
    private final AiUsageLogService aiUsageLogService;
    private final SettingsService settingsService;
    private final SlackNotificationService slackNotificationService;

    @Override
    public SseEmitter chat(ChatDto.ChatRequest request) {
        if (!settingsService.isAiEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI features are currently disabled");
        }

        SseEmitter emitter = new SseEmitter(120_000L);

        String userMessage = request.message();
        String currentUsername = getCurrentUsername();
        String clientIp = extractClientIp();

        // Build RAG context with optional FAQ context
        String systemPrompt = buildRagContext(userMessage, request.faqContext());

        // Stream Claude response, collecting full response for DB persistence
        StringBuilder fullResponse = new StringBuilder();
        long startMs = System.currentTimeMillis();
        AtomicReference<Usage> usageRef = new AtomicReference<>();

        // Use Message objects directly (bypass Spring AI's ST template parser).
        // KB content piped into the system prompt may contain `(`, `<`, `$` etc.
        // that the StringTemplate renderer used by `.system(String)/.user(String)`
        // cannot parse — see "The template string is not valid." failures.
        List<Message> messages = List.of(
                new SystemMessage(systemPrompt),
                new UserMessage(userMessage)
        );
        Flux<ChatResponse> stream = chatClient.prompt(new Prompt(messages))
                .stream()
                .chatResponse();

        stream.subscribe(
                chatResponse -> {
                    try {
                        String text = chatResponse.getResult() != null
                                ? chatResponse.getResult().getOutput().getContent()
                                : null;
                        if (text != null) {
                            fullResponse.append(text);
                            emitter.send(SseEmitter.event().data(text));
                        }
                        // Capture usage from last chunk (Anthropic sends it on message_stop)
                        if (chatResponse.getMetadata() != null
                                && chatResponse.getMetadata().getUsage() != null
                                && chatResponse.getMetadata().getUsage().getTotalTokens() > 0) {
                            usageRef.set(chatResponse.getMetadata().getUsage());
                        }
                    } catch (IOException e) {
                        log.warn("Failed to send SSE chunk", e);
                        emitter.completeWithError(e);
                    }
                },
                error -> {
                    log.error("Chat streaming error", error);
                    long durationMs = System.currentTimeMillis() - startMs;
                    aiUsageLogService.logUsage(AiFeature.SENIOR_CHAT, PROVIDER, MODEL,
                            null, null, durationMs, false, error.getMessage(), clientIp);
                    emitter.completeWithError(error);
                },
                () -> {
                    // Log AI usage
                    long durationMs = System.currentTimeMillis() - startMs;
                    Usage usage = usageRef.get();
                    if (usage != null) {
                        aiUsageLogService.logUsage(AiFeature.SENIOR_CHAT, PROVIDER, MODEL,
                                usage.getPromptTokens().intValue(), usage.getGenerationTokens().intValue(),
                                durationMs, true, null, clientIp);
                    } else {
                        // Fallback: estimate tokens from character count
                        int estimatedInput = systemPrompt.length() / 4;
                        int estimatedOutput = fullResponse.length() / 4;
                        aiUsageLogService.logUsage(AiFeature.SENIOR_CHAT, PROVIDER, MODEL,
                                estimatedInput, estimatedOutput, durationMs, true, null, clientIp);
                    }

                    // Slack notification
                    int estimatedTokens = (userMessage.length() + fullResponse.length()) / 4;
                    slackNotificationService.notifyAiUsage(currentUsername, "Senior Chat", estimatedTokens);

                    // Save messages to DB after streaming completes
                    try {
                        Long sessionId = chatSessionService.saveMessages(
                                request.sessionId(), userMessage, fullResponse.toString());
                        // Send sessionId as the final SSE event
                        emitter.send(SseEmitter.event().name("sessionId").data(sessionId));
                    } catch (Exception e) {
                        log.warn("Failed to save chat messages", e);
                    }
                    emitter.complete();
                }
        );

        emitter.onTimeout(emitter::complete);
        emitter.onError(e -> log.warn("SSE emitter error", e));

        return emitter;
    }

    @Override
    @Transactional(readOnly = true)
    public List<KnowledgeBaseDto.KbResponse> getCuratedFaqs() {
        return knowledgeBaseService.getCuratedFaqs();
    }

    // --- RAG Pipeline ---

    private String buildRagContext(String userMessage, ChatDto.FaqContext faqContext) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a Senior QA Engineer AI assistant. ");
        sb.append("Answer the user's QA-related questions using the following context.\n\n");

        // 0. User-selected FAQ context (highest priority)
        if (faqContext != null) {
            sb.append("=== FAQ 참고 항목 (사용자가 선택한 항목) ===\n");
            sb.append("제목: ").append(faqContext.title()).append("\n");
            sb.append("내용: ").append(faqContext.content()).append("\n\n");
        }

        // 1. Knowledge Base (vector similarity search + hit count increment)
        appendKnowledgeBase(sb, userMessage);

        sb.append("Use the above context for accurate QA guidance. ");
        sb.append("If the context doesn't contain relevant information, use your general QA expertise. ");
        sb.append("Respond in the same language as the user's question.");

        return sb.toString();
    }

    private void appendKnowledgeBase(StringBuilder sb, String userMessage) {
        try {
            float[] queryEmbedding = embeddingService.embed(userMessage, AiFeature.EMBEDDING_SENIOR);
            String vectorStr = embeddingService.toVectorString(queryEmbedding);

            // Priority 1: Manual KB entries (user-written, highest relevance)
            List<KnowledgeBaseEntity> manualResults =
                    knowledgeBaseRepository.findSimilarManual(vectorStr, KB_MANUAL_TOP_K);
            if (!manualResults.isEmpty()) {
                sb.append("=== QA Knowledge Base (직접 작성, 우선 참고) ===\n");
                for (KnowledgeBaseEntity kb : manualResults) {
                    sb.append("- ").append(kb.getTitle()).append(": ").append(kb.getContent()).append("\n");
                }
                sb.append("\n");
            }

            // Priority 2: PDF book chunks (supplementary reference)
            List<KnowledgeBaseEntity> pdfResults =
                    knowledgeBaseRepository.findSimilarPdf(vectorStr, KB_PDF_TOP_K);
            if (!pdfResults.isEmpty()) {
                sb.append("=== QA Knowledge Base (도서 참고) ===\n");
                for (KnowledgeBaseEntity kb : pdfResults) {
                    sb.append("- ").append(kb.getTitle()).append(": ").append(kb.getContent()).append("\n");
                }
                sb.append("\n");
            }

        } catch (Exception e) {
            log.warn("Failed to retrieve KB context via embedding search", e);
        }
    }

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "unknown";
    }

    private String extractClientIp() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return null;
            HttpServletRequest request = attrs.getRequest();
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                int comma = forwarded.indexOf(',');
                return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
            }
            return request.getRemoteAddr();
        } catch (Exception e) {
            return null;
        }
    }

}
