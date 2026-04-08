package com.myqaweb.knowledgebase;

import com.myqaweb.common.EmbeddingService;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Async worker that processes PDF files: text extraction, chunking, embedding generation.
 * Separated from PdfPipelineServiceImpl to ensure Spring @Async proxy works correctly.
 */
@Component
@RequiredArgsConstructor
public class PdfProcessingWorker {

    private static final Logger log = LoggerFactory.getLogger(PdfProcessingWorker.class);

    private static final int MIN_CHUNK_TOKENS = 500;
    private static final int MAX_CHUNK_TOKENS = 800;
    private static final int OVERLAP_TOKENS = 50;
    private static final int RATE_LIMIT_DELAY_MS = 200;
    private static final int RETRY_DELAY_MS = 5000;
    private static final int MAX_RETRIES = 3;

    private static final Pattern CHAPTER_PATTERN = Pattern.compile(
            "^\\s*(제?\\s*\\d+\\s*[장절편부]|Chapter\\s+\\d+|Part\\s+\\d+|CHAPTER\\s+\\d+|PART\\s+\\d+|\\d+\\.\\s+[A-Z가-힣])",
            Pattern.MULTILINE
    );

    private final PdfUploadJobRepository jobRepository;
    private final KnowledgeBaseRepository kbRepository;
    private final EmbeddingService embeddingService;

    @Async
    public void processPdf(Long jobId, byte[] pdfBytes, String bookTitle) {
        PdfUploadJobEntity job = jobRepository.findById(jobId).orElse(null);
        if (job == null) return;

        job.setStatus("PROCESSING");
        jobRepository.save(job);

        try {
            // 1. Extract text from PDF
            String fullText = extractText(pdfBytes);
            if (fullText.isBlank()) {
                throw new RuntimeException("PDF에서 텍스트를 추출할 수 없습니다.");
            }

            // 2. Parse chapters/sections
            List<Section> sections = parseSections(fullText);

            // 3. Chunk each section
            List<Chunk> allChunks = new ArrayList<>();
            for (Section section : sections) {
                List<String> chunkTexts = chunkText(section.content());
                for (int i = 0; i < chunkTexts.size(); i++) {
                    String title = buildChunkTitle(bookTitle, section.name(), i + 1);
                    allChunks.add(new Chunk(title, chunkTexts.get(i)));
                }
            }

            log.info("PDF parsed: jobId={}, book='{}', totalChunks={}", jobId, bookTitle, allChunks.size());

            // 4. Generate embeddings and save to KB (with rate limit handling)
            int savedCount = 0;
            for (int i = 0; i < allChunks.size(); i++) {
                Chunk chunk = allChunks.get(i);
                boolean saved = saveChunkWithRetry(chunk, bookTitle);
                if (saved) savedCount++;

                // Progress log every 50 chunks
                if ((i + 1) % 50 == 0) {
                    log.info("Progress: jobId={}, {}/{} chunks processed", jobId, i + 1, allChunks.size());
                }

                // Rate limit delay between chunks
                Thread.sleep(RATE_LIMIT_DELAY_MS);
            }

            // 5. Mark as done
            job.setStatus("DONE");
            job.setTotalChunks(savedCount);
            job.setCompletedAt(LocalDateTime.now());
            jobRepository.save(job);

            log.info("PDF upload completed: jobId={}, book='{}', chunks={}", jobId, bookTitle, savedCount);

        } catch (Exception e) {
            log.error("PDF processing failed: jobId={}, book='{}'", jobId, bookTitle, e);
            job.setStatus("FAILED");
            job.setErrorMessage(e.getMessage());
            job.setCompletedAt(LocalDateTime.now());
            jobRepository.save(job);
        }
    }

    private boolean saveChunkWithRetry(Chunk chunk, String bookTitle) {
        int retries = 0;
        while (retries < MAX_RETRIES) {
            try {
                float[] embedding = embeddingService.embed(chunk.title() + " " + chunk.content());
                String vectorStr = embeddingService.toVectorString(embedding);

                KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
                entity.setTitle(chunk.title());
                entity.setContent(chunk.content());
                entity.setSource(bookTitle);
                KnowledgeBaseEntity saved = kbRepository.save(entity);
                kbRepository.updateEmbedding(saved.getId(), vectorStr);
                return true;
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                if (msg.contains("429") && retries < MAX_RETRIES - 1) {
                    retries++;
                    log.warn("Rate limit hit for '{}', retry {}/{} after {}ms",
                            chunk.title(), retries, MAX_RETRIES, RETRY_DELAY_MS);
                    try {
                        Thread.sleep(RETRY_DELAY_MS);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return false;
                    }
                } else {
                    log.warn("Failed to process chunk '{}': {}", chunk.title(), msg);
                    return false;
                }
            }
        }
        return false;
    }

    // --- Internal helpers ---

    private String extractText(byte[] pdfBytes) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    List<Section> parseSections(String text) {
        List<Section> sections = new ArrayList<>();
        Matcher matcher = CHAPTER_PATTERN.matcher(text);

        List<int[]> headerPositions = new ArrayList<>();
        List<String> headerNames = new ArrayList<>();

        while (matcher.find()) {
            headerPositions.add(new int[]{matcher.start(), matcher.end()});
            int lineEnd = text.indexOf('\n', matcher.start());
            if (lineEnd == -1) lineEnd = text.length();
            headerNames.add(text.substring(matcher.start(), lineEnd).trim());
        }

        if (headerPositions.isEmpty()) {
            sections.add(new Section(null, text));
        } else {
            if (headerPositions.getFirst()[0] > 0) {
                String preContent = text.substring(0, headerPositions.getFirst()[0]).trim();
                if (!preContent.isEmpty()) {
                    sections.add(new Section(null, preContent));
                }
            }
            for (int i = 0; i < headerPositions.size(); i++) {
                int start = headerPositions.get(i)[0];
                int end = (i + 1 < headerPositions.size())
                        ? headerPositions.get(i + 1)[0]
                        : text.length();
                String content = text.substring(start, end).trim();
                if (!content.isEmpty()) {
                    sections.add(new Section(headerNames.get(i), content));
                }
            }
        }

        return sections;
    }

    List<String> chunkText(String text) {
        List<String> chunks = new ArrayList<>();
        String[] sentences = text.split("(?<=[.!?。])(\\s+)");

        List<String> currentWords = new ArrayList<>();
        int currentTokenCount = 0;

        for (String sentence : sentences) {
            String[] words = sentence.trim().split("\\s+");
            int sentenceTokens = words.length;

            if (currentTokenCount + sentenceTokens > MAX_CHUNK_TOKENS && currentTokenCount >= MIN_CHUNK_TOKENS) {
                chunks.add(String.join(" ", currentWords));
                List<String> overlapWords = getOverlapWords(currentWords, OVERLAP_TOKENS);
                currentWords = new ArrayList<>(overlapWords);
                currentTokenCount = overlapWords.size();
            }

            for (String word : words) {
                if (!word.isEmpty()) {
                    currentWords.add(word);
                    currentTokenCount++;
                }
            }

            if (currentTokenCount > MAX_CHUNK_TOKENS) {
                chunks.add(String.join(" ", currentWords));
                List<String> overlapWords = getOverlapWords(currentWords, OVERLAP_TOKENS);
                currentWords = new ArrayList<>(overlapWords);
                currentTokenCount = overlapWords.size();
            }
        }

        if (!currentWords.isEmpty()) {
            chunks.add(String.join(" ", currentWords));
        }

        return chunks;
    }

    private List<String> getOverlapWords(List<String> words, int overlapSize) {
        if (words.size() <= overlapSize) {
            return new ArrayList<>(words);
        }
        return new ArrayList<>(words.subList(words.size() - overlapSize, words.size()));
    }

    private String buildChunkTitle(String bookTitle, String sectionName, int sequence) {
        String seq = String.format("%03d", sequence);
        if (sectionName == null || sectionName.isBlank()) {
            return bookTitle + " - chunk - " + seq;
        }
        return bookTitle + " - " + sectionName + " - " + seq;
    }

    record Section(String name, String content) {}
    record Chunk(String title, String content) {}
}
