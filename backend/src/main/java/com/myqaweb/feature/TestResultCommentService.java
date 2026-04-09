package com.myqaweb.feature;

import java.util.List;

/**
 * Service interface for TestResult comment thread operations.
 */
public interface TestResultCommentService {
    /**
     * Get all comments for a test result as a tree structure.
     *
     * @param testResultId the test result ID
     * @return list of top-level comments with nested children
     */
    List<TestResultCommentDto.CommentResponse> getCommentsByResultId(Long testResultId);

    /**
     * Add a comment to a test result.
     *
     * @param testResultId the test result ID
     * @param request the comment creation request
     * @return the created comment
     */
    TestResultCommentDto.CommentResponse addComment(Long testResultId, TestResultCommentDto.CreateCommentRequest request);

    /**
     * Delete a comment and its children.
     *
     * @param commentId the comment ID
     */
    void deleteComment(Long commentId);
}
