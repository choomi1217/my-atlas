package com.myqaweb.senior;

import com.myqaweb.common.EmbeddingService;
import com.myqaweb.convention.ConventionEntity;
import com.myqaweb.convention.ConventionRepository;
import com.myqaweb.feature.CompanyEntity;
import com.myqaweb.feature.CompanyRepository;
import com.myqaweb.feature.ProductEntity;
import com.myqaweb.feature.ProductRepository;
import com.myqaweb.feature.SegmentEntity;
import com.myqaweb.feature.SegmentRepository;
import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import com.myqaweb.knowledgebase.KnowledgeBaseEntity;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import com.myqaweb.knowledgebase.KnowledgeBaseService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

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

    private final ChatClient chatClient;
    private final EmbeddingService embeddingService;
    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final KnowledgeBaseService knowledgeBaseService;
    private final CompanyRepository companyRepository;
    private final ProductRepository productRepository;
    private final SegmentRepository segmentRepository;
    private final ConventionRepository conventionRepository;

    @Override
    public SseEmitter chat(ChatDto.ChatRequest request) {
        SseEmitter emitter = new SseEmitter(120_000L);

        String userMessage = request.message();

        // Build RAG context with optional FAQ context
        String systemPrompt = buildRagContext(userMessage, request.faqContext());

        // Stream Claude response
        Flux<String> stream = chatClient.prompt()
                .system(systemPrompt)
                .user(userMessage)
                .stream()
                .content();

        stream.subscribe(
                chunk -> {
                    try {
                        emitter.send(SseEmitter.event().data(chunk));
                    } catch (IOException e) {
                        log.warn("Failed to send SSE chunk", e);
                        emitter.completeWithError(e);
                    }
                },
                error -> {
                    log.error("Chat streaming error", error);
                    emitter.completeWithError(error);
                },
                emitter::complete
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

        // 1. Company Features (active company → products → segments)
        appendCompanyFeatures(sb);

        // 2. Knowledge Base (vector similarity search + hit count increment)
        appendKnowledgeBase(sb, userMessage);

        // 3. Terminology Conventions (all)
        appendConventions(sb);

        sb.append("Use the above context for accurate, company-specific QA guidance. ");
        sb.append("If the context doesn't contain relevant information, use your general QA expertise. ");
        sb.append("Always use the terminology conventions when applicable. ");
        sb.append("Respond in the same language as the user's question.");

        return sb.toString();
    }

    private void appendCompanyFeatures(StringBuilder sb) {
        Optional<CompanyEntity> activeCompany = companyRepository.findByIsActiveTrue();
        if (activeCompany.isPresent()) {
            CompanyEntity company = activeCompany.get();
            sb.append("=== Company Features ===\n");
            sb.append("Company: ").append(company.getName()).append("\n");

            List<ProductEntity> products = productRepository.findAllByCompanyId(company.getId());
            for (ProductEntity product : products) {
                sb.append("Product: ").append(product.getName())
                        .append(" (").append(product.getPlatform()).append(")");
                if (product.getDescription() != null) {
                    sb.append(" - ").append(product.getDescription());
                }
                sb.append("\n");

                List<SegmentEntity> segments = segmentRepository.findAllByProductId(product.getId());
                for (SegmentEntity segment : segments) {
                    sb.append("  Segment: ").append(segment.getName()).append("\n");
                }
            }
            sb.append("\n");
        }
    }

    private void appendKnowledgeBase(StringBuilder sb, String userMessage) {
        try {
            float[] queryEmbedding = embeddingService.embed(userMessage);
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

            // Increment hit counts for retrieved KB entries
            incrementHitCounts(manualResults);
            incrementHitCounts(pdfResults);

        } catch (Exception e) {
            log.warn("Failed to retrieve KB context via embedding search", e);
        }
    }

    private void incrementHitCounts(List<KnowledgeBaseEntity> kbEntries) {
        for (KnowledgeBaseEntity kb : kbEntries) {
            try {
                knowledgeBaseRepository.incrementHitCount(kb.getId());
            } catch (Exception e) {
                log.warn("Failed to increment hit count for KB id={}", kb.getId(), e);
            }
        }
    }

    private void appendConventions(StringBuilder sb) {
        List<ConventionEntity> conventions = conventionRepository.findAll();
        if (!conventions.isEmpty()) {
            sb.append("=== Terminology Conventions ===\n");
            for (ConventionEntity conv : conventions) {
                sb.append("- ").append(conv.getTerm()).append(": ").append(conv.getDefinition()).append("\n");
            }
            sb.append("\n");
        }
    }
}
