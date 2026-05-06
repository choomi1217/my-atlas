package com.myqaweb.teststudio;

import com.myqaweb.feature.Priority;
import com.myqaweb.feature.TestStep;
import com.myqaweb.feature.TestType;

import java.util.List;

/**
 * JSON schema record used to deserialize Claude's DRAFT TC response.
 * Maps to a single generated test case before persistence.
 */
public record DraftTestCaseDto(
        String title,
        String preconditions,
        List<TestStep> steps,
        List<String> expectedResults,
        Priority priority,
        TestType testType,
        List<String> suggestedSegmentPath
) {}
