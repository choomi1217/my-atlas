import apiClient from './client';
import {
  ExecTargetKind,
  ApiResponse,
  ApplySuggestedPathResult,
  Company,
  Product,
  Segment,
  Platform,
  TestCase,
  TestCaseImage,
  TestCasePriority,
  TestCaseType,
  TestCaseStatus,
  TestStep,
  TestRun,
  Version,
  VersionPhase,
  RunResultStatus,
  TestResult,
  TestResultComment,
  Ticket,
  TicketPriority,
  TrackerConfig,
  FailedTestCaseInfo,
  DailyReport,
  TrendData,
  ReleaseReadiness,
  Dashboard,
  AgentExecutionJob,
  AgentExecutionResult,
  AgentExecutionStatus,
  AgentJobContext,
  AgentJobPage,
  AgentLiveProgress,
  AgentWorkerStatus,
} from '@/types/features';
// ProgressStats is used indirectly via Version/VersionPhase types

/**
 * Company API endpoints.
 */
export const companyApi = {
  getAll: async (): Promise<Company[]> => {
    const response = await apiClient.get<ApiResponse<Company[]>>(
      '/api/companies'
    );
    return response.data.data;
  },

  create: async (name: string): Promise<Company> => {
    const response = await apiClient.post<ApiResponse<Company>>(
      '/api/companies',
      { name }
    );
    return response.data.data;
  },

  setActive: async (id: number): Promise<Company> => {
    const response = await apiClient.patch<ApiResponse<Company>>(
      `/api/companies/${id}/activate`
    );
    return response.data.data;
  },

  update: async (id: number, name: string): Promise<Company> => {
    const response = await apiClient.put<ApiResponse<Company>>(
      `/api/companies/${id}`,
      { name }
    );
    return response.data.data;
  },

  deactivate: async (id: number): Promise<Company> => {
    const response = await apiClient.patch<ApiResponse<Company>>(
      `/api/companies/${id}/deactivate`
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/companies/${id}`);
  },
};

/**
 * Product API endpoints.
 */
export const productApi = {
  getByCompanyId: async (companyId: number): Promise<Product[]> => {
    const response = await apiClient.get<ApiResponse<Product[]>>(
      '/api/products',
      {
        params: { companyId },
      }
    );
    return response.data.data;
  },

  create: async (
    companyId: number,
    name: string,
    platform: Platform,
    description?: string
  ): Promise<Product> => {
    const response = await apiClient.post<ApiResponse<Product>>(
      '/api/products',
      {
        companyId,
        name,
        platform,
        description,
      }
    );
    return response.data.data;
  },

  update: async (
    id: number,
    name: string,
    platform: Platform,
    description?: string
  ): Promise<Product> => {
    const response = await apiClient.put<ApiResponse<Product>>(
      `/api/products/${id}`,
      {
        companyId: 0,
        name,
        platform,
        description,
      }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/products/${id}`);
  },

  setExecProfile: async (
    id: number,
    execBaseUrl: string,
    execSeedNote: string,
    execTargetKind?: ExecTargetKind
  ): Promise<Product> => {
    const response = await apiClient.patch<ApiResponse<Product>>(
      `/api/products/${id}/exec-profile`,
      { execBaseUrl, execSeedNote, execTargetKind }
    );
    return response.data.data;
  },
};

/**
 * Segment API endpoints.
 */
export const segmentApi = {
  getByProductId: async (productId: number): Promise<Segment[]> => {
    const response = await apiClient.get<ApiResponse<Segment[]>>(
      '/api/segments',
      {
        params: { productId },
      }
    );
    return response.data.data;
  },

  create: async (
    productId: number,
    name: string,
    parentId?: number
  ): Promise<Segment> => {
    const response = await apiClient.post<ApiResponse<Segment>>(
      '/api/segments',
      {
        productId,
        name,
        parentId: parentId ?? null,
      }
    );
    return response.data.data;
  },

  update: async (id: number, name: string): Promise<Segment> => {
    const response = await apiClient.put<ApiResponse<Segment>>(
      `/api/segments/${id}`,
      { name }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/segments/${id}`);
  },

  reparent: async (id: number, parentId: number | null): Promise<Segment> => {
    const response = await apiClient.patch<ApiResponse<Segment>>(
      `/api/segments/${id}/parent`,
      { parentId }
    );
    return response.data.data;
  },

  reorder: async (
    productId: number,
    parentId: number | null,
    segmentIds: number[]
  ): Promise<void> => {
    await apiClient.patch('/api/segments/reorder', {
      productId,
      parentId,
      segmentIds,
    });
  },
};

/**
 * Test Case API endpoints.
 */
export const testCaseApi = {
  getByProductId: async (productId: number): Promise<TestCase[]> => {
    const response = await apiClient.get<ApiResponse<TestCase[]>>(
      '/api/test-cases',
      {
        params: { productId },
      }
    );
    return response.data.data;
  },

  getByCompanyId: async (
    companyId: number,
    status?: TestCaseStatus
  ): Promise<TestCase[]> => {
    const response = await apiClient.get<ApiResponse<TestCase[]>>(
      '/api/test-cases',
      {
        params: status ? { companyId, status } : { companyId },
      }
    );
    return response.data.data;
  },

  /**
   * PATCH /api/test-cases/{id}/path — user manually replaces the segment path.
   * This is NOT forced injection: user explicitly chooses the path via picker / DnD.
   */
  updatePath: async (id: number, path: number[]): Promise<TestCase> => {
    const response = await apiClient.patch<ApiResponse<TestCase>>(
      `/api/test-cases/${id}/path`,
      { path }
    );
    return response.data.data;
  },

  /**
   * POST /api/test-cases/{id}/apply-suggested-path — user applies Claude's recommendation.
   */
  applySuggestedPath: async (id: number): Promise<ApplySuggestedPathResult> => {
    const response = await apiClient.post<ApiResponse<ApplySuggestedPathResult>>(
      `/api/test-cases/${id}/apply-suggested-path`
    );
    return response.data.data;
  },

  /**
   * POST /api/test-cases/bulk-apply-suggested-path — user applies recommendations in bulk.
   */
  bulkApplySuggestedPath: async (
    testCaseIds: number[]
  ): Promise<ApplySuggestedPathResult[]> => {
    const response = await apiClient.post<ApiResponse<ApplySuggestedPathResult[]>>(
      '/api/test-cases/bulk-apply-suggested-path',
      { testCaseIds }
    );
    return response.data.data;
  },

  create: async (
    productId: number,
    title: string,
    path: number[] = [],
    description?: string,
    promptText?: string,
    priority: TestCasePriority = TestCasePriority.MEDIUM,
    testType: TestCaseType = TestCaseType.FUNCTIONAL,
    status: TestCaseStatus = TestCaseStatus.DRAFT,
    preconditions?: string,
    steps?: TestStep[],
    expectedResults?: string[]
  ): Promise<TestCase> => {
    const response = await apiClient.post<ApiResponse<TestCase>>(
      '/api/test-cases',
      {
        productId,
        path,
        title,
        description,
        promptText,
        preconditions,
        steps: steps || [],
        expectedResults,
        priority,
        testType,
        status,
      }
    );
    return response.data.data;
  },

  update: async (
    id: number,
    productId: number,
    title: string,
    path: number[] = [],
    description?: string,
    promptText?: string,
    priority: TestCasePriority = TestCasePriority.MEDIUM,
    testType: TestCaseType = TestCaseType.FUNCTIONAL,
    status: TestCaseStatus = TestCaseStatus.DRAFT,
    preconditions?: string,
    steps?: TestStep[],
    expectedResults?: string[]
  ): Promise<TestCase> => {
    const response = await apiClient.put<ApiResponse<TestCase>>(
      `/api/test-cases/${id}`,
      {
        productId,
        path,
        title,
        description,
        promptText,
        preconditions,
        steps: steps || [],
        expectedResults,
        priority,
        testType,
        status,
      }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/test-cases/${id}`);
  },

  generateDraft: async (
    productId: number,
    path: number[] = []
  ): Promise<TestCase[]> => {
    const response = await apiClient.post<ApiResponse<TestCase[]>>(
      '/api/test-cases/generate-draft',
      {
        productId,
        path,
      }
    );
    return response.data.data;
  },
};

/**
 * Test Run API endpoints.
 */
export const testRunApi = {
  getByProductId: async (productId: number): Promise<TestRun[]> => {
    const response = await apiClient.get<ApiResponse<TestRun[]>>(
      `/api/products/${productId}/test-runs`
    );
    return response.data.data;
  },

  getById: async (id: number): Promise<TestRun> => {
    const response = await apiClient.get<ApiResponse<TestRun>>(
      `/api/test-runs/${id}`
    );
    return response.data.data;
  },

  create: async (
    productId: number,
    name: string,
    description: string,
    testCaseIds: number[]
  ): Promise<TestRun> => {
    const response = await apiClient.post<ApiResponse<TestRun>>(
      `/api/products/${productId}/test-runs`,
      {
        productId,
        name,
        description,
        testCaseIds,
      }
    );
    return response.data.data;
  },

  update: async (
    id: number,
    name?: string,
    description?: string,
    testCaseIds?: number[]
  ): Promise<TestRun> => {
    const response = await apiClient.patch<ApiResponse<TestRun>>(
      `/api/test-runs/${id}`,
      {
        name,
        description,
        testCaseIds,
      }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/test-runs/${id}`);
  },
};

/**
 * Version API endpoints.
 */
export const versionApi = {
  getByProductId: async (productId: number): Promise<Version[]> => {
    const response = await apiClient.get<ApiResponse<Version[]>>(
      `/api/products/${productId}/versions`
    );
    return response.data.data;
  },

  getById: async (id: number): Promise<Version> => {
    const response = await apiClient.get<ApiResponse<Version>>(
      `/api/versions/${id}`
    );
    return response.data.data;
  },

  create: async (
    productId: number,
    name: string,
    description: string,
    releaseDate: string | null
  ): Promise<Version> => {
    const response = await apiClient.post<ApiResponse<Version>>(
      `/api/products/${productId}/versions`,
      {
        productId,
        name,
        description,
        releaseDate,
      }
    );
    return response.data.data;
  },

  getFailedTestCases: async (versionId: number): Promise<FailedTestCaseInfo[]> => {
    const response = await apiClient.get<ApiResponse<FailedTestCaseInfo[]>>(
      `/api/versions/${versionId}/failed-test-cases`
    );
    return response.data.data;
  },

  update: async (
    id: number,
    name?: string,
    description?: string,
    releaseDate?: string | null
  ): Promise<Version> => {
    const response = await apiClient.patch<ApiResponse<Version>>(
      `/api/versions/${id}`,
      {
        name,
        description,
        releaseDate,
      }
    );
    return response.data.data;
  },

  copy: async (
    id: number,
    newName: string,
    newReleaseDate: string | null
  ): Promise<Version> => {
    const response = await apiClient.post<ApiResponse<Version>>(
      `/api/versions/${id}/copy`,
      {
        newName,
        newReleaseDate,
      }
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/versions/${id}`);
  },
};

/**
 * Version Phase API endpoints.
 */
export const versionPhaseApi = {
  getByVersionId: async (versionId: number): Promise<VersionPhase[]> => {
    const response = await apiClient.get<ApiResponse<VersionPhase[]>>(
      `/api/versions/${versionId}/phases`
    );
    return response.data.data;
  },

  addPhase: async (
    versionId: number,
    phaseName: string,
    testRunIds: number[],
    testCaseIds?: number[]
  ): Promise<VersionPhase> => {
    const response = await apiClient.post<ApiResponse<VersionPhase>>(
      `/api/versions/${versionId}/phases`,
      {
        phaseName,
        testRunIds,
        testCaseIds: testCaseIds || [],
      }
    );
    return response.data.data;
  },

  addTestCases: async (
    versionId: number,
    phaseId: number,
    testCaseIds: number[]
  ): Promise<void> => {
    await apiClient.post(
      `/api/versions/${versionId}/phases/${phaseId}/test-cases`,
      { testCaseIds }
    );
  },

  removeTestCases: async (
    versionId: number,
    phaseId: number,
    testCaseIds: number[]
  ): Promise<void> => {
    await apiClient.delete(
      `/api/versions/${versionId}/phases/${phaseId}/test-cases`,
      { data: { testCaseIds } }
    );
  },

  updatePhase: async (
    versionId: number,
    phaseId: number,
    phaseName?: string,
    testRunIds?: number[]
  ): Promise<VersionPhase> => {
    const response = await apiClient.patch<ApiResponse<VersionPhase>>(
      `/api/versions/${versionId}/phases/${phaseId}`,
      {
        phaseName,
        testRunIds,
      }
    );
    return response.data.data;
  },

  deletePhase: async (versionId: number, phaseId: number): Promise<void> => {
    await apiClient.delete(`/api/versions/${versionId}/phases/${phaseId}`);
  },

  reorderPhase: async (
    versionId: number,
    phaseId: number,
    newOrderIndex: number
  ): Promise<void> => {
    await apiClient.post(
      `/api/versions/${versionId}/phases/${phaseId}/reorder`,
      {
        newOrderIndex,
      }
    );
  },
};

/**
 * Test Result API endpoints.
 */
export const testResultApi = {
  getByVersionId: async (versionId: number): Promise<TestResult[]> => {
    const response = await apiClient.get<ApiResponse<TestResult[]>>(
      `/api/versions/${versionId}/results`
    );
    return response.data.data;
  },

  getByVersionPhaseId: async (
    versionId: number,
    phaseId: number
  ): Promise<TestResult[]> => {
    const response = await apiClient.get<ApiResponse<TestResult[]>>(
      `/api/versions/${versionId}/phases/${phaseId}/results`
    );
    return response.data.data;
  },

  updateResult: async (
    versionId: number,
    resultId: number,
    status: RunResultStatus,
    comment?: string,
    priority?: TicketPriority
  ): Promise<TestResult> => {
    const response = await apiClient.patch<ApiResponse<TestResult>>(
      `/api/versions/${versionId}/results/${resultId}`,
      {
        status,
        comment,
        priority,
      }
    );
    return response.data.data;
  },
};

/**
 * Feature image API (shared upload for TestCase images and comment images).
 */
export const featureImageApi = {
  upload: async (file: File): Promise<{ url: string; filename: string; originalName: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ApiResponse<{ url: string; filename: string; originalName: string }>>(
      '/api/feature-images',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },
};

/**
 * TestCase image API.
 */
export const testCaseImageApi = {
  getByTestCaseId: async (testCaseId: number): Promise<TestCaseImage[]> => {
    const response = await apiClient.get<ApiResponse<TestCaseImage[]>>(
      `/api/test-cases/${testCaseId}/images`
    );
    return response.data.data;
  },

  addImage: async (
    testCaseId: number,
    filename: string,
    originalName: string
  ): Promise<TestCaseImage> => {
    const response = await apiClient.post<ApiResponse<TestCaseImage>>(
      `/api/test-cases/${testCaseId}/images`,
      { filename, originalName }
    );
    return response.data.data;
  },

  removeImage: async (testCaseId: number, imageId: number): Promise<void> => {
    await apiClient.delete(`/api/test-cases/${testCaseId}/images/${imageId}`);
  },
};

/**
 * TestResult comment thread API.
 */
export const testResultCommentApi = {
  getComments: async (versionId: number, resultId: number): Promise<TestResultComment[]> => {
    const response = await apiClient.get<ApiResponse<TestResultComment[]>>(
      `/api/versions/${versionId}/results/${resultId}/comments`
    );
    return response.data.data;
  },

  addComment: async (
    versionId: number,
    resultId: number,
    content: string,
    author?: string,
    parentId?: number,
    imageUrl?: string
  ): Promise<TestResultComment> => {
    const response = await apiClient.post<ApiResponse<TestResultComment>>(
      `/api/versions/${versionId}/results/${resultId}/comments`,
      { author, content, parentId: parentId ?? null, imageUrl: imageUrl ?? null }
    );
    return response.data.data;
  },

  deleteComment: async (versionId: number, resultId: number, commentId: number): Promise<void> => {
    await apiClient.delete(
      `/api/versions/${versionId}/results/${resultId}/comments/${commentId}`
    );
  },
};

/**
 * Ticket (Notion page / Jira issue) API endpoints.
 */
export const ticketApi = {
  create: async (
    versionId: number,
    resultId: number,
    summary: string,
    description?: string,
    priority?: string,
    pageUrl?: string
  ): Promise<Ticket> => {
    const response = await apiClient.post<ApiResponse<Ticket>>(
      `/api/versions/${versionId}/results/${resultId}/tickets`,
      { summary, description, priority, pageUrl }
    );
    return response.data.data;
  },

  getConfig: async (): Promise<TrackerConfig> => {
    const response = await apiClient.get<ApiResponse<TrackerConfig>>('/api/tickets/config');
    return response.data.data;
  },

  getByResultId: async (versionId: number, resultId: number): Promise<Ticket[]> => {
    const response = await apiClient.get<ApiResponse<Ticket[]>>(
      `/api/versions/${versionId}/results/${resultId}/tickets`
    );
    return response.data.data;
  },

  delete: async (versionId: number, resultId: number, ticketId: number): Promise<void> => {
    await apiClient.delete(
      `/api/versions/${versionId}/results/${resultId}/tickets/${ticketId}`
    );
  },

  refresh: async (versionId: number, resultId: number, ticketId: number): Promise<Ticket> => {
    const response = await apiClient.post<ApiResponse<Ticket>>(
      `/api/versions/${versionId}/results/${resultId}/tickets/${ticketId}/refresh`
    );
    return response.data.data;
  },

  refreshAllByPhase: async (versionId: number, phaseId: number): Promise<number> => {
    const response = await apiClient.post<ApiResponse<number>>(
      `/api/versions/${versionId}/phases/${phaseId}/tickets/refresh-all`
    );
    return response.data.data;
  },
};

/**
 * Statistics API endpoints.
 */
export const statisticsApi = {
  getDailyReport: async (phaseId: number, date: string): Promise<DailyReport> => {
    const response = await apiClient.get<ApiResponse<DailyReport>>(
      `/api/phases/${phaseId}/reports/daily`,
      { params: { date } }
    );
    return response.data.data;
  },

  getTrend: async (phaseId: number, from: string, to: string): Promise<TrendData> => {
    const response = await apiClient.get<ApiResponse<TrendData>>(
      `/api/phases/${phaseId}/reports/trend`,
      { params: { from, to } }
    );
    return response.data.data;
  },

  getReleaseReadiness: async (versionId: number): Promise<ReleaseReadiness> => {
    const response = await apiClient.get<ApiResponse<ReleaseReadiness>>(
      `/api/versions/${versionId}/release-readiness`
    );
    return response.data.data;
  },

  getDashboard: async (versionId: number): Promise<Dashboard> => {
    const response = await apiClient.get<ApiResponse<Dashboard>>(
      `/api/versions/${versionId}/dashboard`
    );
    return response.data.data;
  },

  runSnapshot: async (date: string): Promise<void> => {
    await apiClient.post('/api/admin/snapshots/run', null, { params: { date } });
  },
};

/**
 * Agentic Test Execution API (registry_v20).
 */
export const agentExecutionApi = {
  createSingle: async (
    productId: number,
    targetTestCaseId: number
  ): Promise<number> => {
    const response = await apiClient.post<ApiResponse<{ jobId: number }>>(
      '/api/agent-executions',
      { scope: 'SINGLE', productId, targetTestCaseId }
    );
    return response.data.data.jobId;
  },

  createBatch: async (
    productId: number,
    phaseId: number,
    scope: 'PHASE_ALL' | 'PHASE_UNTESTED' | 'PHASE_PREV_FAIL'
  ): Promise<number> => {
    const response = await apiClient.post<ApiResponse<{ jobId: number }>>(
      '/api/agent-executions',
      { scope, productId, phaseId }
    );
    return response.data.data.jobId;
  },

  /** 선택한 TC만 Phase 결과에 반영하며 실행. 같은 Phase의 대기·실행 중 Job과 TC가 겹치면 409 */
  createSelected: async (
    productId: number,
    phaseId: number,
    testCaseIds: number[]
  ): Promise<number> => {
    const response = await apiClient.post<ApiResponse<{ jobId: number }>>(
      '/api/agent-executions',
      { scope: 'PHASE_SELECTED', productId, phaseId, testCaseIds }
    );
    return response.data.data.jobId;
  },

  /** 전체 Job 목록(제품·Phase 이름 포함). status는 여러 개 지정 가능 */
  listQueue: async (params: {
    status: AgentExecutionStatus[];
    page: number;
    size: number;
    direction: 'ASC' | 'DESC';
  }): Promise<AgentJobPage> => {
    const response = await apiClient.get<ApiResponse<AgentJobPage>>(
      '/api/agent-executions/queue',
      // status=A&status=B 형태로 직렬화 (기본값은 status[]=A)
      { params, paramsSerializer: { indexes: null } }
    );
    const data = response.data.data;
    if (!data || !Array.isArray(data.items)) {
      throw new Error('잘못된 큐 응답');
    }
    return data;
  },

  /** 연결된 워커 (마지막 heartbeat 15초 이내) */
  listWorkers: async (): Promise<AgentWorkerStatus[]> => {
    const response = await apiClient.get<ApiResponse<AgentWorkerStatus[]>>(
      '/api/agent-executions/workers'
    );
    const data = response.data.data;
    return Array.isArray(data) ? data : [];
  },

  /** Job이 실행하는 TC 내용(Step·기대 결과). 결과가 나오기 전에도 TC 목록을 그리는 데 쓴다 */
  getContext: async (jobId: number): Promise<AgentJobContext> => {
    const response = await apiClient.get<ApiResponse<AgentJobContext>>(
      `/api/agent-executions/${jobId}/context`
    );
    const data = response.data.data;
    if (!data || !Array.isArray(data.testCases)) {
      throw new Error('잘못된 컨텍스트 응답');
    }
    return data;
  },

  /** Step 스크린샷. 204(없음) 또는 빈 응답이면 null */
  getScreenshot: async (
    jobId: number,
    testCaseId: number,
    stepOrder: number
  ): Promise<Blob | null> => {
    const response = await apiClient.get<Blob>(
      `/api/agent-executions/${jobId}/screenshots`,
      { params: { testCaseId, stepOrder }, responseType: 'blob' }
    );
    if (response.status === 204 || !response.data || response.data.size === 0) {
      return null;
    }
    return response.data;
  },

  listResults: async (jobId: number): Promise<AgentExecutionResult[]> => {
    const response = await apiClient.get<ApiResponse<AgentExecutionResult[]>>(
      `/api/agent-executions/${jobId}/results`
    );
    return response.data.data;
  },

  getJob: async (jobId: number): Promise<AgentExecutionJob> => {
    const response = await apiClient.get<ApiResponse<AgentExecutionJob>>(
      `/api/agent-executions/${jobId}`
    );
    return response.data.data;
  },

  /** 실행 화면 최신 프레임. 204(프레임 없음/종료) 또는 빈 응답이면 null */
  getFrame: async (jobId: number): Promise<Blob | null> => {
    const response = await apiClient.get<Blob>(
      `/api/agent-executions/${jobId}/frame`,
      { responseType: 'blob' }
    );
    if (response.status === 204 || !response.data || response.data.size === 0) {
      return null;
    }
    return response.data;
  },

  /** 현재 TC/Step 진행 상황. 진행 정보가 없으면(종료 등) null */
  getProgress: async (jobId: number): Promise<AgentLiveProgress | null> => {
    const response = await apiClient.get<ApiResponse<AgentLiveProgress | null>>(
      `/api/agent-executions/${jobId}/progress`
    );
    return response.data.data ?? null;
  },

  getResult: async (
    jobId: number,
    testCaseId: number
  ): Promise<AgentExecutionResult> => {
    const response = await apiClient.get<ApiResponse<AgentExecutionResult>>(
      `/api/agent-executions/${jobId}/results/${testCaseId}`
    );
    return response.data.data;
  },

  cancel: async (jobId: number): Promise<AgentExecutionJob> => {
    const response = await apiClient.post<ApiResponse<AgentExecutionJob>>(
      `/api/agent-executions/${jobId}/cancel`
    );
    return response.data.data;
  },
};
