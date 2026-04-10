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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private static final int MAX_CHUNK_CHARS = 3000;
    private static final int MIN_SECTION_CHARS = 200;
    private static final int RATE_LIMIT_DELAY_MS = 200;
    private static final int RETRY_DELAY_MS = 5000;
    private static final int MAX_RETRIES = 3;

    private static final int REPEATING_HEADER_MAX_LENGTH = 100;
    private static final int REPEATING_HEADER_MIN_COUNT = 3;
    private static final double REPEATING_HEADER_RATIO = 0.4;
    private static final int ESTIMATED_LINES_PER_PAGE = 45;

    // Page number patterns — only match when the ENTIRE line is a page number
    private static final Pattern PAGE_NUMBER_PATTERN = Pattern.compile(
            "^\\s*(" +
                    "\\d{1,4}" +                          // "66", " 3 "
                    "|\\d{1,4}\\s*(?:of|/)\\s*\\d{1,4}" + // "66 of 72", "3/10"
                    "|-\\s*\\d{1,4}\\s*-" +                // "- 66 -"
                    "|Page\\s+\\d+" +                       // "Page 66"
                    "|p\\.\\s*\\d+" +                       // "p. 66"
                    ")\\s*$",
            Pattern.MULTILINE | Pattern.CASE_INSENSITIVE
    );

    // "제N장", "Chapter N", "Part N", multi-level numbering ("6.1 Title"), "Section N"
    // Note: single-level "N. Title" excluded to avoid matching numbered lists
    private static final Pattern CHAPTER_PATTERN = Pattern.compile(
            "^\\s*(제\\s*\\d+\\s*[장편부]|Chapter\\s+\\d+|Part\\s+\\d+|CHAPTER\\s+\\d+|PART\\s+\\d+" +
                    "|\\d{1,2}\\.\\d{1,2}\\.?\\s+\\S" +           // "6.1 Title", "6.2. Title"
                    "|Section\\s+\\d+" +                            // "Section 3"
                    "|SECTION\\s+\\d+" +                            // "SECTION 3"
                    ")",
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

            // 2. Clean extracted text (remove headers/footers, page numbers, normalize whitespace)
            fullText = cleanExtractedText(fullText);

            // 3. Parse chapters/sections and merge small sections
            List<Section> sections = parseSections(fullText);
            sections = mergeSections(sections);

            // 4. Chunk each section (global sequence numbering)
            List<Chunk> allChunks = new ArrayList<>();
            int globalSeq = 1;
            for (Section section : sections) {
                List<String> chunkTexts = chunkText(section.content());
                chunkTexts = enforceMaxSize(chunkTexts);
                for (String chunkText : chunkTexts) {
                    String title = buildChunkTitle(bookTitle, section.name(), globalSeq++);
                    allChunks.add(new Chunk(title, chunkText));
                }
            }

            log.info("PDF parsed: jobId={}, book='{}', totalChunks={}", jobId, bookTitle, allChunks.size());

            // 5. Generate embeddings and save to KB (with rate limit handling)
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

            // 6. Mark as done
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

    // --- Section/Chunk post-processing ---

    /**
     * Step 2: Merges sections shorter than MIN_SECTION_CHARS into adjacent sections.
     * This eliminates noise chunks from TOC lines or tiny fragments.
     */
    List<Section> mergeSections(List<Section> sections) {
        if (sections.size() <= 1) {
            return sections;
        }

        List<Section> merged = new ArrayList<>();
        for (int i = 0; i < sections.size(); i++) {
            Section current = sections.get(i);
            if (current.content().length() >= MIN_SECTION_CHARS) {
                merged.add(current);
            } else if (!merged.isEmpty()) {
                // Append small section to the previous section
                Section prev = merged.removeLast();
                merged.add(new Section(prev.name(),
                        prev.content() + "\n" + current.content()));
            } else if (i + 1 < sections.size()) {
                // First section is small — prepend to next section
                Section next = sections.get(i + 1);
                sections.set(i + 1, new Section(next.name(),
                        current.content() + "\n" + next.content()));
            } else {
                // Only section and it's small — keep as-is
                merged.add(current);
            }
        }
        return merged;
    }

    /**
     * Step 4: Splits any chunk exceeding MAX_CHUNK_CHARS at word boundaries.
     * Safety net for when sentence-based splitting fails to divide large text.
     */
    List<String> enforceMaxSize(List<String> chunks) {
        List<String> result = new ArrayList<>();
        for (String chunk : chunks) {
            if (chunk.length() <= MAX_CHUNK_CHARS) {
                result.add(chunk);
            } else {
                // Force-split at word boundaries
                String[] words = chunk.split("\\s+");
                StringBuilder sb = new StringBuilder();
                for (String word : words) {
                    if (sb.length() + word.length() + 1 > MAX_CHUNK_CHARS && !sb.isEmpty()) {
                        result.add(sb.toString().trim());
                        // Overlap: take last OVERLAP_TOKENS words from the split point
                        String[] splitWords = sb.toString().trim().split("\\s+");
                        sb = new StringBuilder();
                        int overlapStart = Math.max(0, splitWords.length - OVERLAP_TOKENS);
                        for (int j = overlapStart; j < splitWords.length; j++) {
                            sb.append(splitWords[j]).append(" ");
                        }
                    }
                    sb.append(word).append(" ");
                }
                if (!sb.isEmpty()) {
                    result.add(sb.toString().trim());
                }
            }
        }
        return result;
    }

    // --- Text cleaning methods ---

    /**
     * Applies all cleaning steps to raw extracted PDF text.
     * Called after extractText() and before parseSections().
     */
    String cleanExtractedText(String rawText) {
        int originalLength = rawText.length();
        String cleaned = rawText;
        cleaned = removeRepeatingHeaders(cleaned);
        cleaned = removePageNumbers(cleaned);
        cleaned = normalizeWhitespace(cleaned);
        log.info("Text cleaning: {} → {} chars (removed {})",
                originalLength, cleaned.length(), originalLength - cleaned.length());
        return cleaned;
    }

    /**
     * Detects and removes repeating header/footer lines.
     * Lines ≤ 100 chars appearing ≥ max(3, totalLines × 0.4) times are considered headers/footers.
     */
    String removeRepeatingHeaders(String text) {
        String[] lines = text.split("\n", -1);
        int totalLines = lines.length;

        // Count occurrences of each non-blank trimmed line
        Map<String, Integer> lineCounts = new HashMap<>();
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty() && trimmed.length() <= REPEATING_HEADER_MAX_LENGTH) {
                lineCounts.merge(trimmed, 1, Integer::sum);
            }
        }

        // Estimate page count from total lines, then determine threshold
        int estimatedPages = Math.max(1, totalLines / ESTIMATED_LINES_PER_PAGE);
        int threshold = Math.max(REPEATING_HEADER_MIN_COUNT,
                (int) (estimatedPages * REPEATING_HEADER_RATIO));

        // Filter out repeating header/footer lines
        StringBuilder sb = new StringBuilder();
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()
                    && trimmed.length() <= REPEATING_HEADER_MAX_LENGTH
                    && lineCounts.getOrDefault(trimmed, 0) >= threshold) {
                continue; // Skip this repeating header/footer line
            }
            sb.append(line).append("\n");
        }

        // Remove trailing newline added by loop
        if (!sb.isEmpty() && sb.charAt(sb.length() - 1) == '\n') {
            sb.setLength(sb.length() - 1);
        }
        return sb.toString();
    }

    /**
     * Removes lines that consist entirely of page number patterns.
     * Does not touch numbers embedded within body text.
     */
    String removePageNumbers(String text) {
        return PAGE_NUMBER_PATTERN.matcher(text).replaceAll("");
    }

    /**
     * Normalizes whitespace: collapses excessive blank lines, trims lines, replaces tabs.
     */
    String normalizeWhitespace(String text) {
        // Replace tabs with spaces
        String result = text.replace('\t', ' ');

        // Collapse consecutive spaces (2+) to single space within each line
        result = result.replaceAll(" {2,}", " ");

        // Trim each line
        String[] lines = result.split("\n", -1);
        StringBuilder sb = new StringBuilder();
        int consecutiveBlank = 0;
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                consecutiveBlank++;
                if (consecutiveBlank <= 2) {
                    sb.append("\n");
                }
            } else {
                consecutiveBlank = 0;
                sb.append(trimmed).append("\n");
            }
        }

        // Remove trailing newline
        String finalResult = sb.toString();
        if (finalResult.endsWith("\n")) {
            finalResult = finalResult.substring(0, finalResult.length() - 1);
        }
        return finalResult;
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
