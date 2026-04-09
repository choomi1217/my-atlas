package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for TestResult comment thread.
 */
@RestController
@RequestMapping("/api/versions/{versionId}/results/{resultId}/comments")
@RequiredArgsConstructor
public class TestResultCommentController {
    private final TestResultCommentService commentService;

    /**
     * GET — List all comments for a test result (tree structure).
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<TestResultCommentDto.CommentResponse>>> getComments(
            @PathVariable Long versionId,
            @PathVariable Long resultId) {
        List<TestResultCommentDto.CommentResponse> comments = commentService.getCommentsByResultId(resultId);
        return ResponseEntity.ok(ApiResponse.ok(comments));
    }

    /**
     * POST — Add a comment.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<TestResultCommentDto.CommentResponse>> addComment(
            @PathVariable Long versionId,
            @PathVariable Long resultId,
            @Valid @RequestBody TestResultCommentDto.CreateCommentRequest request) {
        TestResultCommentDto.CommentResponse comment = commentService.addComment(resultId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(comment));
    }

    /**
     * DELETE — Delete a comment and its children.
     */
    @DeleteMapping("/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(
            @PathVariable Long versionId,
            @PathVariable Long resultId,
            @PathVariable Long commentId) {
        commentService.deleteComment(commentId);
        return ResponseEntity.ok(new ApiResponse<>(true, "Comment deleted", null));
    }
}
