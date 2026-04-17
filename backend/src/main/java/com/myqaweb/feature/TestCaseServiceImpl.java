package com.myqaweb.feature;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TestCaseServiceImpl implements TestCaseService {
    private final TestCaseRepository testCaseRepository;
    private final ProductRepository productRepository;
    private final SegmentRepository segmentRepository;
    private final TestCaseImageRepository testCaseImageRepository;
    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public List<TestCaseDto.TestCaseResponse> getByProductId(Long productId) {
        return testCaseRepository.findAllByProductId(productId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TestCaseDto.TestCaseResponse> findById(Long id) {
        return testCaseRepository.findById(id).map(this::toResponse);
    }

    @Override
    public TestCaseDto.TestCaseResponse create(TestCaseDto.TestCaseRequest request) {
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + request.productId()));

        TestCaseEntity entity = new TestCaseEntity();
        entity.setProduct(product);
        entity.setPath(request.path() != null ? request.path() : new Long[0]);
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setPromptText(request.promptText());
        entity.setPreconditions(request.preconditions());
        entity.setSteps(request.steps() != null ? request.steps() : new ArrayList<>());
        entity.setExpectedResult(request.expectedResult());
        entity.setPriority(request.priority() != null ? request.priority() : Priority.MEDIUM);
        entity.setTestType(request.testType() != null ? request.testType() : TestType.FUNCTIONAL);
        entity.setStatus(request.status() != null ? request.status() : TestStatus.DRAFT);

        TestCaseEntity saved = testCaseRepository.save(entity);
        return toResponse(saved);
    }

    @Override
    public TestCaseDto.TestCaseResponse update(Long id, TestCaseDto.TestCaseRequest request) {
        TestCaseEntity entity = testCaseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Test case not found: " + id));

        entity.setPath(request.path() != null ? request.path() : new Long[0]);
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setPromptText(request.promptText());
        entity.setPreconditions(request.preconditions());
        entity.setSteps(request.steps() != null ? request.steps() : new ArrayList<>());
        entity.setExpectedResult(request.expectedResult());
        entity.setPriority(request.priority() != null ? request.priority() : Priority.MEDIUM);
        entity.setTestType(request.testType() != null ? request.testType() : TestType.FUNCTIONAL);
        entity.setStatus(request.status() != null ? request.status() : TestStatus.DRAFT);

        TestCaseEntity updated = testCaseRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        if (!testCaseRepository.existsById(id)) {
            throw new IllegalArgumentException("Test case not found: " + id);
        }
        testCaseRepository.deleteByIdDirectly(id);
    }

    @Override
    public List<TestCaseDto.TestCaseResponse> generateDraft(TestCaseDto.GenerateDraftRequest request) {
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + request.productId()));

        String pathNames = resolvePathNames(request.path());

        String context = String.format(
                "Product: %s\nPath: %s",
                product.getName(),
                pathNames
        );

        String prompt = context + "\n\n위 경로에 대한 Test Case를 JSON 배열 형식으로 생성해주세요. " +
                "[{\"order\": 1, \"action\": \"...\", \"expected\": \"...\"}, ...]";

        try {
            String response = chatClient.prompt().user(prompt).call().content();
            log.info("AI Draft response received for product: {}, path: {}", request.productId(), pathNames);

            List<TestStep> steps = parseSteps(response);

            TestCaseEntity entity = new TestCaseEntity();
            entity.setProduct(product);
            entity.setPath(request.path() != null ? request.path() : new Long[0]);
            entity.setTitle("AI Draft: " + pathNames);
            entity.setSteps(steps);
            entity.setStatus(TestStatus.DRAFT);
            entity.setPriority(Priority.MEDIUM);
            entity.setTestType(TestType.FUNCTIONAL);

            TestCaseEntity saved = testCaseRepository.save(entity);
            return List.of(toResponse(saved));
        } catch (Exception e) {
            log.error("Failed to generate test case draft for product: {}, path: {}", request.productId(), pathNames, e);
            return List.of();
        }
    }

    /**
     * Resolves segment IDs to their names, joined by " > ".
     */
    private String resolvePathNames(Long[] path) {
        if (path == null || path.length == 0) {
            return "";
        }
        return Arrays.stream(path)
                .map(segmentRepository::findById)
                .filter(Optional::isPresent)
                .map(opt -> opt.get().getName())
                .collect(Collectors.joining(" > "));
    }

    private List<TestStep> parseSteps(String response) {
        try {
            String jsonStr = response.trim();
            if (jsonStr.startsWith("```")) {
                jsonStr = jsonStr.substring(jsonStr.indexOf("["), jsonStr.lastIndexOf("]") + 1);
            } else if (!jsonStr.startsWith("[")) {
                int startIdx = jsonStr.indexOf("[");
                if (startIdx != -1) {
                    jsonStr = jsonStr.substring(startIdx, jsonStr.lastIndexOf("]") + 1);
                }
            }

            return objectMapper.readValue(jsonStr, objectMapper.getTypeFactory().constructCollectionType(List.class, TestStep.class));
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse test steps from AI response", e);
            return new ArrayList<>();
        }
    }

    private TestCaseDto.TestCaseResponse toResponse(TestCaseEntity entity) {
        List<TestCaseDto.TestCaseImageResponse> images =
                testCaseImageRepository.findAllByTestCaseIdOrderByOrderIndex(entity.getId())
                        .stream()
                        .map(img -> new TestCaseDto.TestCaseImageResponse(
                                img.getId(),
                                img.getFilename(),
                                img.getOriginalName(),
                                img.getOrderIndex(),
                                "/api/feature-images/" + img.getFilename()
                        ))
                        .toList();

        return new TestCaseDto.TestCaseResponse(
                entity.getId(),
                entity.getProduct().getId(),
                entity.getPath(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getPromptText(),
                entity.getPreconditions(),
                entity.getSteps(),
                entity.getExpectedResult(),
                entity.getPriority(),
                entity.getTestType(),
                entity.getStatus(),
                images,
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getTestStudioJobId()
        );
    }
}
