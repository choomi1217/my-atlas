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

// --- v2.5: Style-by-Example (스타일 세트 + 예시 TC + 보조 설정) ---

import { TestStep, TestCasePriority, TestCaseType } from './features';

/** 보조 설정 — 생성 TC의 Step 포맷 힌트. */
export type StepFormat = 'ACTION_EXPECTED' | 'GIVEN_WHEN_THEN' | 'NARRATIVE';
/** 보조 설정 — 상세 수준 힌트. */
export type DetailLevel = 'CONCISE' | 'STANDARD' | 'DETAILED';
/** 보조 설정 — 문체/어조 힌트. */
export type Tone = 'BULLET' | 'FORMAL' | 'PLAIN';

/** 셀렉트 박스에 노출되는 기본 견본 이름 (백엔드 DefaultStyleSamples.SAMPLE_NAME). */
export const SAMPLE_PROFILE_NAME = 'Sample';

/** 스타일 세트(프로필). */
export interface StyleProfile {
  id: number;
  companyId: number;
  name: string;
  exampleCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** 세트 내 예시 TC. 기본 견본(Sample)은 id/profileId 가 null. */
export interface StyleExample {
  id: number | null;
  profileId: number | null;
  title: string;
  preconditions?: string | null;
  steps?: TestStep[] | null;
  expectedResults?: string[] | null;
  priority?: TestCasePriority | null;
  testType?: TestCaseType | null;
  sortOrder: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** 예시 TC 생성/수정 입력 (기존 TC 작성 폼과 동일 필드). */
export interface StyleExampleInput {
  title: string;
  preconditions?: string | null;
  steps?: TestStep[];
  expectedResults?: string[];
  priority?: TestCasePriority | null;
  testType?: TestCaseType | null;
  sortOrder?: number | null;
}

/** Company 보조 설정 + 활성 세트 선택. selectedProfileId=null → 기본 견본 Sample. */
export interface TestStudioConfig {
  companyId: number;
  selectedProfileId: number | null;
  stepFormat: StepFormat;
  detailLevel: DetailLevel;
  tone: Tone;
}
