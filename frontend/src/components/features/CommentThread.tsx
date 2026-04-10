import { useState, useCallback } from 'react';
import { TestResultComment } from '@/types/features';
import { featureImageApi, testResultCommentApi } from '@/api/features';

interface CommentThreadProps {
  versionId: number;
  resultId: number;
  comments: TestResultComment[];
  onRefresh: () => void;
}

interface CommentNodeProps {
  comment: TestResultComment;
  depth: number;
  versionId: number;
  resultId: number;
  onRefresh: () => void;
}

function CommentNode({ comment, depth, versionId, resultId, onRefresh }: CommentNodeProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyAuthor, setReplyAuthor] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await testResultCommentApi.addComment(
        versionId,
        resultId,
        replyContent,
        replyAuthor || undefined,
        comment.id
      );
      setReplyContent('');
      setReplyAuthor('');
      setShowReply(false);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-gray-200 pl-3' : ''}>
      <div className="py-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{comment.author || 'Anonymous'}</span>
          <span>&middot;</span>
          <span>{formatDate(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{comment.content}</p>
        {comment.imageUrl && (
          <div className="mt-2">
            <img
              src={comment.imageUrl}
              alt="comment attachment"
              className="max-w-xs max-h-48 rounded border cursor-pointer hover:opacity-80"
              onClick={() => window.open(comment.imageUrl!, '_blank')}
            />
          </div>
        )}
        <button
          onClick={() => setShowReply(!showReply)}
          className="text-xs text-indigo-500 hover:text-indigo-700 mt-1"
        >
          {showReply ? 'Cancel' : 'Reply'}
        </button>

        {showReply && (
          <div className="mt-2 space-y-1">
            <input
              type="text"
              value={replyAuthor}
              onChange={(e) => setReplyAuthor(e.target.value)}
              placeholder="Author (optional)"
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
            />
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Reply..."
              rows={2}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded resize-none"
            />
            <button
              onClick={handleReply}
              disabled={submitting || !replyContent.trim()}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post Reply'}
            </button>
          </div>
        )}
      </div>

      {comment.children.map((child) => (
        <CommentNode
          key={child.id}
          comment={child}
          depth={depth + 1}
          versionId={versionId}
          resultId={resultId}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

export default function CommentThread({
  versionId,
  resultId,
  comments,
  onRefresh,
}: CommentThreadProps) {
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const uploaded = await featureImageApi.upload(imageFile);
        imageUrl = uploaded.url;
      }
      await testResultCommentApi.addComment(
        versionId,
        resultId,
        content,
        author || undefined,
        undefined,
        imageUrl
      );
      setContent('');
      setAuthor('');
      setImageFile(null);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }, [versionId, resultId, content, author, imageFile, onRefresh]);

  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-gray-600 mb-2">
        Comments ({comments.length})
      </h4>

      {comments.length > 0 ? (
        <div className="space-y-1 mb-3">
          {comments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              depth={0}
              versionId={versionId}
              resultId={resultId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">No comments yet.</p>
      )}

      <div className="border-t border-gray-200 pt-2 space-y-1">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author (optional)"
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded resize-none"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 cursor-pointer hover:text-indigo-600">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
            {imageFile ? `📎 ${imageFile.name}` : '📎 Attach image'}
          </label>
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
