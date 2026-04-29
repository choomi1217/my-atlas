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
}

/**
 * Knowledge Base item interface.
 */
export interface KbItem {
  id: number;
  title: string;
  content: string;
  snippet: string;
  category: string | null;
  source: string | null;
  hitCount: number;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Knowledge Base create/update request.
 */
export interface KbRequest {
  title: string;
  content: string;
  category?: string;
}

/**
 * KB Category for autocomplete.
 */
export interface KbCategory {
  id: number;
  name: string;
  createdAt: string;
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

/**
 * Chat session interface.
 */
export interface ChatSession {
  id: number;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat session detail with messages.
 */
export interface ChatSessionDetail {
  id: number;
  title: string | null;
  messages: ChatSessionMessage[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Persisted chat message from DB.
 */
export interface ChatSessionMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
