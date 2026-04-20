/**
 * Test Studio — input source type.
 */
export type SourceType = 'MARKDOWN' | 'PDF';

/**
 * Test Studio — Job lifecycle status.
 */
export type TestStudioJobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

/**
 * Test Studio Job response.
 */
export interface TestStudioJob {
  id: number;
  productId: number;
  sourceType: SourceType;
  sourceTitle: string;
  status: TestStudioJobStatus;
  errorMessage: string | null;
  generatedCount: number;
  createdAt: string;
  completedAt: string | null;
}
