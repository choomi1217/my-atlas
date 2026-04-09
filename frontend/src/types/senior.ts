/**
 * Chat message interface.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * FAQ item interface.
 */
export interface FaqItem {
  id: number;
  title: string;
  content: string;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * FAQ context passed from FAQ to Chat.
 */
export interface FaqContext {
  title: string;
  content: string;
}

/**
 * FAQ create/update request.
 */
export interface FaqRequest {
  title: string;
  content: string;
  tags?: string;
}

/**
 * Knowledge Base item interface.
 */
export interface KbItem {
  id: number;
  title: string;
  content: string;
  category: string | null;
  tags: string | null;
  source: string | null;
  hitCount: number;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Knowledge Base create/update request.
 */
export interface KbRequest {
  title: string;
  content: string;
  category?: string;
  tags?: string;
}

/**
 * PDF upload job status.
 */
export interface PdfUploadJob {
  id: number;
  bookTitle: string;
  originalFilename: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  totalChunks: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Convention item interface.
 */
export interface ConventionItem {
  id: number;
  term: string;
  definition: string;
  category: string | null;
  createdAt: string;
}
