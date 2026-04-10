package com.myqaweb.feature;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TestResultCommentServiceImpl implements TestResultCommentService {
    private final TestResultCommentRepository commentRepository;
    private final TestResultRepository testResultRepository;

    @Override
    @Transactional(readOnly = true)
    public List<TestResultCommentDto.CommentResponse> getCommentsByResultId(Long testResultId) {
        List<TestResultCommentEntity> allComments =
                commentRepository.findAllByTestResultIdOrderByCreatedAtAsc(testResultId);
        return buildTree(allComments);
    }

    @Override
    public TestResultCommentDto.CommentResponse addComment(Long testResultId, TestResultCommentDto.CreateCommentRequest request) {
        TestResultEntity testResult = testResultRepository.findById(testResultId)
                .orElseThrow(() -> new IllegalArgumentException("TestResult not found: " + testResultId));

        TestResultCommentEntity entity = new TestResultCommentEntity();
        entity.setTestResult(testResult);
        entity.setAuthor(request.author());
        entity.setContent(request.content());
        entity.setImageUrl(request.imageUrl());

        if (request.parentId() != null) {
            TestResultCommentEntity parent = commentRepository.findById(request.parentId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent comment not found: " + request.parentId()));
            entity.setParent(parent);
        }

        TestResultCommentEntity saved = commentRepository.save(entity);
        return toResponse(saved, List.of());
    }

    @Override
    public void deleteComment(Long commentId) {
        if (!commentRepository.existsById(commentId)) {
            throw new IllegalArgumentException("Comment not found: " + commentId);
        }
        commentRepository.deleteById(commentId);
    }

    /**
     * Build a tree structure from a flat list of comments.
     */
    private List<TestResultCommentDto.CommentResponse> buildTree(List<TestResultCommentEntity> allComments) {
        Map<Long, List<TestResultCommentEntity>> childrenMap = allComments.stream()
                .filter(c -> c.getParent() != null)
                .collect(Collectors.groupingBy(c -> c.getParent().getId()));

        return allComments.stream()
                .filter(c -> c.getParent() == null)
                .map(c -> toResponseWithChildren(c, childrenMap))
                .toList();
    }

    private TestResultCommentDto.CommentResponse toResponseWithChildren(
            TestResultCommentEntity entity,
            Map<Long, List<TestResultCommentEntity>> childrenMap) {
        List<TestResultCommentDto.CommentResponse> children =
                childrenMap.getOrDefault(entity.getId(), new ArrayList<>())
                        .stream()
                        .map(c -> toResponseWithChildren(c, childrenMap))
                        .toList();
        return toResponse(entity, children);
    }

    private TestResultCommentDto.CommentResponse toResponse(
            TestResultCommentEntity entity,
            List<TestResultCommentDto.CommentResponse> children) {
        return new TestResultCommentDto.CommentResponse(
                entity.getId(),
                entity.getTestResult().getId(),
                entity.getParent() != null ? entity.getParent().getId() : null,
                entity.getAuthor(),
                entity.getContent(),
                entity.getImageUrl(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                children
        );
    }
}
