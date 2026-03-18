package com.myqaweb.feature;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TestCaseServiceImpl implements TestCaseService {
    private final TestCaseRepository testCaseRepository;
    private final FeatureRepository featureRepository;
    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public List<TestCaseDto.TestCaseResponse> getByFeatureId(Long featureId) {
        return testCaseRepository.findAllByFeatureId(featureId)
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
        FeatureEntity feature = featureRepository.findById(request.featureId())
                .orElseThrow(() -> new IllegalArgumentException("Feature not found: " + request.featureId()));

        TestCaseEntity entity = new TestCaseEntity();
        entity.setFeature(feature);
        entity.setTitle(request.title());
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

        entity.setTitle(request.title());
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
        testCaseRepository.deleteById(id);
    }

    @Override
    public List<TestCaseDto.TestCaseResponse> generateDraft(Long featureId) {
        FeatureEntity feature = featureRepository.findById(featureId)
                .orElseThrow(() -> new IllegalArgumentException("Feature not found: " + featureId));

        String context = String.format(
                "Feature: %s\nDescription: %s\nTest Scope: %s",
                feature.getName(),
                feature.getDescription() != null ? feature.getDescription() : "",
                feature.getPromptText() != null ? feature.getPromptText() : ""
        );

        String prompt = context + "\n\n위 Feature에 대한 Test Case를 JSON 배열 형식으로 생성해주세요. " +
                "[{\"order\": 1, \"action\": \"...\", \"expected\": \"...\"}, ...]";

        try {
            String response = chatClient.prompt().user(prompt).call().content();
            log.info("AI Draft response received for feature: {}", featureId);

            // Parse JSON response
            List<TestStep> steps = parseSteps(response);

            // Create test case entity
            TestCaseEntity entity = new TestCaseEntity();
            entity.setFeature(feature);
            entity.setTitle("AI Draft: " + feature.getName());
            entity.setSteps(steps);
            entity.setStatus(TestStatus.DRAFT);
            entity.setPriority(Priority.MEDIUM);
            entity.setTestType(TestType.FUNCTIONAL);

            TestCaseEntity saved = testCaseRepository.save(entity);
            return List.of(toResponse(saved));
        } catch (Exception e) {
            log.error("Failed to generate test case draft for feature: {}", featureId, e);
            return List.of();
        }
    }

    private List<TestStep> parseSteps(String response) {
        try {
            // Extract JSON array from response (handle markdown code blocks)
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
        return new TestCaseDto.TestCaseResponse(
                entity.getId(),
                entity.getFeature().getId(),
                entity.getTitle(),
                entity.getPreconditions(),
                entity.getSteps(),
                entity.getExpectedResult(),
                entity.getPriority(),
                entity.getTestType(),
                entity.getStatus(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
