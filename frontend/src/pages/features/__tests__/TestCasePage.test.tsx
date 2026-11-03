import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TestCasePage from '../TestCasePage';
import { agentExecutionApi, segmentApi, testCaseApi } from '@/api/features';
import {
  TestCasePriority,
  TestCaseStatus,
  TestCaseType,
  type Segment,
  type TestCase,
} from '@/types/features';

vi.mock('@/api/features', () => ({
  agentExecutionApi: { createSingle: vi.fn() },
  companyApi: {
    getAll: vi.fn().mockResolvedValue([{ id: 1, name: 'My Atlas' }]),
  },
  productApi: {
    getByCompanyId: vi.fn().mockResolvedValue([
      { id: 10, companyId: 1, name: 'My Senior' },
    ]),
  },
  segmentApi: {
    getByProductId: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    delete: vi.fn(),
    reparent: vi.fn(),
  },
  testCaseApi: {
    getByProductId: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/components/features/SegmentTreeView', () => ({
  SegmentTreeView: () => <div data-testid="segment-tree-view-stub" />,
}));

vi.mock('@/components/features/TestCaseFormModal', () => ({
  default: () => null,
}));

vi.mock('@/components/features/ConfirmDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/features/ImageRefText', () => ({
  default: () => null,
}));

vi.mock('@/components/features/Breadcrumb', () => ({
  Breadcrumb: ({ product }: { product?: { name: string } }) => (
    <nav data-testid="breadcrumb-stub">
      <span>Product Test Suite</span>
      {product && <span>{product.name}</span>}
    </nav>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/features/companies/1/products/10']}>
      <Routes>
        <Route
          path="/features/companies/:companyId/products/:productId"
          element={<TestCasePage />}
        />
        <Route path="/automation/jobs/77" element={<div>새 Job 페이지</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('TestCasePage 레이아웃 (PR-A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Breadcrumb 외 별도의 큰 페이지 헤더(<h1>{product.name}</h1>)를 노출하지 않는다', async () => {
    renderPage();

    // 데이터 로딩 후 페이지가 렌더되기를 기다림
    await waitFor(() => {
      expect(screen.getByTestId('tc-page-container')).toBeInTheDocument();
    });

    // 페이지 본문에 product.name 을 가진 <h1> 가 더 이상 존재하지 않아야 함
    // (Breadcrumb stub 안에서는 product.name 이 <span> 으로 노출)
    const h1Elements = screen.queryAllByRole('heading', { level: 1 });
    expect(h1Elements).toHaveLength(0);

    // "Test Cases" 부제목도 제거되었는지 확인
    expect(screen.queryByText('Test Cases')).not.toBeInTheDocument();
  });

  it('컨테이너에 tc-page-container testid 와 max-w-7xl 클래스가 적용된다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('tc-page-container')).toBeInTheDocument();
    });

    const container = screen.getByTestId('tc-page-container');
    // 부모 컨테이너의 자식이 max-w-7xl wrapper 인지 확인
    const innerWrapper = container.querySelector('.max-w-7xl');
    expect(innerWrapper).not.toBeNull();
    expect(innerWrapper).toHaveClass('mx-auto');
  });

  it('Breadcrumb 은 그대로 노출되며 product 컨텍스트를 유지한다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('breadcrumb-stub')).toBeInTheDocument();
    });

    const breadcrumb = screen.getByTestId('breadcrumb-stub');
    expect(breadcrumb).toHaveTextContent('Product Test Suite');
    expect(breadcrumb).toHaveTextContent('My Senior');
  });
});

describe('TestCasePage AI 시험 실행 (registry_v31)', () => {
  const segment: Segment = {
    id: 1,
    name: '로그인',
    productId: 10,
    parentId: null,
    orderIndex: 0,
  };
  const testCase: TestCase = {
    id: 501,
    productId: 10,
    path: [1],
    title: '로그인 성공',
    steps: [],
    priority: TestCasePriority.MEDIUM,
    testType: TestCaseType.FUNCTIONAL,
    status: TestCaseStatus.ACTIVE,
    createdAt: '2026-11-01T09:00:00',
    updatedAt: '2026-11-01T09:00:00',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom에는 IntersectionObserver가 없다 — TC가 있으면 scroll spy가 사용한다
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      }
    );
    vi.mocked(segmentApi.getByProductId).mockResolvedValueOnce([segment]);
    vi.mocked(testCaseApi.getByProductId).mockResolvedValueOnce([testCase]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a single job and navigates to its page', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.createSingle).mockResolvedValue(77);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'AI 시험 실행' }));

    expect(await screen.findByText('새 Job 페이지')).toBeInTheDocument();
    expect(agentExecutionApi.createSingle).toHaveBeenCalledWith(10, 501);
  });

  it('ignores a second click while the job is being created', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.createSingle).mockReturnValue(new Promise<number>(() => {}));
    renderPage();

    const button = await screen.findByRole('button', { name: 'AI 시험 실행' });
    await user.click(button);
    await user.click(button);

    expect(agentExecutionApi.createSingle).toHaveBeenCalledTimes(1);
  });

  it('shows the failure in agent-run-error and stays on the page', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.createSingle).mockRejectedValue(new Error('실행 불가'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'AI 시험 실행' }));

    expect(await screen.findByTestId('agent-run-error')).toHaveTextContent('실행 불가');
    expect(screen.queryByText('새 Job 페이지')).not.toBeInTheDocument();
  });
});
