package com.myqaweb.feature;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for TestResultCommentServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
class TestResultCommentServiceImplTest {
    @Mock
    private TestResultCommentRepository commentRepository;

    @Mock
    private TestResultRepository testResultRepository;

    @InjectMocks
    private TestResultCommentServiceImpl commentService;

    // --- getCommentsByResultId ---

    @Test
    void getCommentsByResultId_returnsEmptyList_whenNoComments() {
        when(commentRepository.findAllByTestResultIdOrderByCreatedAtAsc(1L))
                .thenReturn(List.of());

        List<TestResultCommentDto.CommentResponse> result = commentService.getCommentsByResultId(1L);

        assertTrue(result.isEmpty());
        verify(commentRepository).findAllByTestResultIdOrderByCreatedAtAsc(1L);
    }

    @Test
    void getCommentsByResultId_buildsTreeStructure() {
        // Create test result
        TestResultEntity testResult = new TestResultEntity();
        testResult.setId(1L);

        // Create parent comment
        TestResultCommentEntity parentComment = new TestResultCommentEntity();
        parentComment.setId(10L);
        parentComment.setTestResult(testResult);
        parentComment.setParent(null);
        parentComment.setAuthor("QA");
        parentComment.setContent("Top-level comment");
        parentComment.setCreatedAt(LocalDateTime.now());
        parentComment.setUpdatedAt(LocalDateTime.now());

        // Create child comment
        TestResultCommentEntity childComment = new TestResultCommentEntity();
        childComment.setId(20L);
        childComment.setTestResult(testResult);
        childComment.setParent(parentComment);
        childComment.setAuthor("Dev");
        childComment.setContent("Reply to top-level");
        childComment.setCreatedAt(LocalDateTime.now());
        childComment.setUpdatedAt(LocalDateTime.now());

        // Create another top-level comment (no children)
        TestResultCommentEntity topLevel2 = new TestResultCommentEntity();
        topLevel2.setId(30L);
        topLevel2.setTestResult(testResult);
        topLevel2.setParent(null);
        topLevel2.setAuthor("PM");
        topLevel2.setContent("Another top-level");
        topLevel2.setCreatedAt(LocalDateTime.now());
        topLevel2.setUpdatedAt(LocalDateTime.now());

        when(commentRepository.findAllByTestResultIdOrderByCreatedAtAsc(1L))
                .thenReturn(List.of(parentComment, childComment, topLevel2));

        List<TestResultCommentDto.CommentResponse> result = commentService.getCommentsByResultId(1L);

        // Should have 2 top-level comments
        assertEquals(2, result.size());

        // First top-level has 1 child
        TestResultCommentDto.CommentResponse first = result.get(0);
        assertEquals(10L, first.id());
        assertEquals("Top-level comment", first.content());
        assertEquals(1, first.children().size());
        assertEquals(20L, first.children().get(0).id());
        assertEquals("Reply to top-level", first.children().get(0).content());

        // Second top-level has no children
        TestResultCommentDto.CommentResponse second = result.get(1);
        assertEquals(30L, second.id());
        assertTrue(second.children().isEmpty());
    }

    // --- addComment ---

    @Test
    void addComment_createsTopLevelComment() {
        TestResultEntity testResult = new TestResultEntity();
        testResult.setId(1L);

        when(testResultRepository.findById(1L)).thenReturn(Optional.of(testResult));

        TestResultCommentEntity saved = new TestResultCommentEntity();
        saved.setId(10L);
        saved.setTestResult(testResult);
        saved.setAuthor("QA");
        saved.setContent("A comment");
        saved.setParent(null);
        saved.setCreatedAt(LocalDateTime.now());
        saved.setUpdatedAt(LocalDateTime.now());
        when(commentRepository.save(any())).thenReturn(saved);

        TestResultCommentDto.CreateCommentRequest request =
                new TestResultCommentDto.CreateCommentRequest("QA", "A comment", null, null);

        TestResultCommentDto.CommentResponse result = commentService.addComment(1L, request);

        assertNotNull(result);
        assertEquals(10L, result.id());
        assertEquals("QA", result.author());
        assertEquals("A comment", result.content());
        assertNull(result.parentId());
        verify(testResultRepository).findById(1L);
        verify(commentRepository).save(any());
    }

    @Test
    void addComment_createsReplyWithParent() {
        TestResultEntity testResult = new TestResultEntity();
        testResult.setId(1L);

        TestResultCommentEntity parentComment = new TestResultCommentEntity();
        parentComment.setId(10L);
        parentComment.setTestResult(testResult);

        when(testResultRepository.findById(1L)).thenReturn(Optional.of(testResult));
        when(commentRepository.findById(10L)).thenReturn(Optional.of(parentComment));

        TestResultCommentEntity saved = new TestResultCommentEntity();
        saved.setId(20L);
        saved.setTestResult(testResult);
        saved.setParent(parentComment);
        saved.setAuthor("Dev");
        saved.setContent("Reply");
        saved.setCreatedAt(LocalDateTime.now());
        saved.setUpdatedAt(LocalDateTime.now());
        when(commentRepository.save(any())).thenReturn(saved);

        TestResultCommentDto.CreateCommentRequest request =
                new TestResultCommentDto.CreateCommentRequest("Dev", "Reply", 10L, null);

        TestResultCommentDto.CommentResponse result = commentService.addComment(1L, request);

        assertNotNull(result);
        assertEquals(20L, result.id());
        assertEquals(10L, result.parentId());
        assertEquals("Reply", result.content());
        verify(commentRepository).findById(10L);
        verify(commentRepository).save(any());
    }

    @Test
    void addComment_throwsWhenTestResultNotFound() {
        when(testResultRepository.findById(99L)).thenReturn(Optional.empty());

        TestResultCommentDto.CreateCommentRequest request =
                new TestResultCommentDto.CreateCommentRequest("QA", "comment", null, null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> commentService.addComment(99L, request));
        assertTrue(ex.getMessage().contains("TestResult not found"));
        verify(commentRepository, never()).save(any());
    }

    @Test
    void addComment_throwsWhenParentCommentNotFound() {
        TestResultEntity testResult = new TestResultEntity();
        testResult.setId(1L);

        when(testResultRepository.findById(1L)).thenReturn(Optional.of(testResult));
        when(commentRepository.findById(99L)).thenReturn(Optional.empty());

        TestResultCommentDto.CreateCommentRequest request =
                new TestResultCommentDto.CreateCommentRequest("QA", "reply", 99L, null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> commentService.addComment(1L, request));
        assertTrue(ex.getMessage().contains("Parent comment not found"));
        verify(commentRepository, never()).save(any());
    }

    // --- deleteComment ---

    @Test
    void deleteComment_deletesExistingComment() {
        when(commentRepository.existsById(10L)).thenReturn(true);

        commentService.deleteComment(10L);

        verify(commentRepository).existsById(10L);
        verify(commentRepository).deleteById(10L);
    }

    @Test
    void deleteComment_throwsWhenCommentNotFound() {
        when(commentRepository.existsById(99L)).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> commentService.deleteComment(99L));
        assertTrue(ex.getMessage().contains("Comment not found"));
        verify(commentRepository, never()).deleteById(anyLong());
    }
}
