import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VersionPhaseDetailPage from '../VersionPhaseDetailPage';
import {
  versionApi,
  testResultApi,
  testCaseApi,
  segmentApi,
  testResultCommentApi,
  ticketApi,
  agentExecutionApi,
} from '@/api/features';
import {
  RunResultStatus,
  TestCasePriority,
  TestCaseStatus,
  TestCaseType,
  TicketPriority,
  TicketTracker,
} from '@/types/features';
import type { Version, ProgressStats, TestCase, TestResult, Ticket } from '@/types/features';

vi.mock('@/api/features', () => ({
  versionApi: { getById: vi.fn() },
  testResultApi: { getByVersionPhaseId: vi.fn(), updateResult: vi.fn() },
  testCaseApi: { getByProductId: vi.fn() },
  segmentApi: { getByProductId: vi.fn() },
  testResultCommentApi: { getComments: vi.fn() },
  ticketApi: {
    getConfig: vi.fn(),
    getByResultId: vi.fn(),
    create: vi.fn(),
    refresh: vi.fn(),
    refreshAllByPhase: vi.fn(),
  },
  featureImageApi: {},
  agentExecutionApi: { createBatch: vi.fn() },
}));

const emptyStats: ProgressStats = {
  total: 0,
  completed: 0,
  pass: 0,
  fail: 0,
  blocked: 0,
  skipped: 0,
  retest: 0,
  untested: 0,
};

const makeVersion = (name: string): Version => ({
  id: 100,
  productId: 10,
  name,
  phases: [
    {
      id: 200,
      phaseName: 'Phase 1',
      testRuns: [],
      totalTestCaseCount: 1,
      orderIndex: 0,
      phaseProgress: emptyStats,
    },
  ],
  totalProgress: emptyStats,
  isReleaseDatePassed: false,
  createdAt: '2026-10-01T00:00:00',
  updatedAt: '2026-10-01T00:00:00',
});

const makeTestCase = (id: number, title: string): TestCase => ({
  id,
  productId: 10,
  path: [],
  title,
  steps: [],
  priority: TestCasePriority.HIGH,
  testType: TestCaseType.FUNCTIONAL,
  status: TestCaseStatus.ACTIVE,
  createdAt: '2026-10-01T00:00:00',
  updatedAt: '2026-10-01T00:00:00',
});

const makeResult = (overrides: Partial<TestResult>): TestResult => ({
  id: 1,
  versionId: 100,
  versionPhaseId: 200,
  testCaseId: 10,
  testCaseTitle: '로그인 실패',
  status: RunResultStatus.FAIL,
  priority: null,
  comment: null,
  executedAt: '2026-11-04T10:00:00',
  executedBy: 'AGENT',
  createdAt: '2026-11-04T10:00:00',
  updatedAt: '2026-11-04T10:00:00',
  ...overrides,
});

const AI_REASON = '[AI FAIL] #2 FAIL: 버튼 없음\n스크린샷 참조';

const failResult = makeResult({ id: 1, testCaseId: 10, comment: AI_REASON });
const passResult = makeResult({
  id: 2,
  testCaseId: 11,
  testCaseTitle: '회원가입',
  status: RunResultStatus.PASS,
  comment: '통과 메모',
});

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: 1,
  testResultId: 1,
  issueKey: 'page-1',
  issueUrl: 'https://www.notion.so/page-1',
  tracker: TicketTracker.NOTION,
  summary: 'FAIL: 로그인 실패',
  status: 'Waiting...',
  createdAt: '2026-11-04T10:00:00',
  updatedAt: '2026-11-04T10:00:00',
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/features/companies/1/products/10/versions/100/phases/200']}>
      <Routes>
        <Route
          path="/features/companies/:companyId/products/:productId/versions/:versionId/phases/:phaseId"
          element={<VersionPhaseDetailPage />}
        />
        <Route path="/automation" element={<div>Automation 페이지</div>} />
      </Routes>
    </MemoryRouter>
  );

const givenResults = (...results: TestResult[]) => {
  vi.mocked(testResultApi.getByVersionPhaseId).mockResolvedValue(results);
};

const givenConfigured = (configured: boolean) => {
  vi.mocked(ticketApi.getConfig).mockResolvedValue({ tracker: TicketTracker.NOTION, configured });
};

/** Expands the row by its title and opens the ticket dialog via "+ 티켓 추가". */
const openTicketDialog = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(await screen.findByText(title));
  await user.click(screen.getByRole('button', { name: '+ 티켓 추가' }));
  return screen.getByTestId('ticket-dialog');
};

describe('VersionPhaseDetailPage', () => {
  beforeEach(() => {
    vi.mocked(versionApi.getById).mockResolvedValue(makeVersion('v1.0'));
    vi.mocked(testResultApi.getByVersionPhaseId).mockResolvedValue([]);
    vi.mocked(testCaseApi.getByProductId).mockResolvedValue([
      makeTestCase(10, '로그인 실패'),
      makeTestCase(11, '회원가입'),
    ]);
    vi.mocked(segmentApi.getByProductId).mockResolvedValue([]);
    vi.mocked(testResultCommentApi.getComments).mockResolvedValue([]);
    vi.mocked(ticketApi.getByResultId).mockResolvedValue([]);
    vi.mocked(agentExecutionApi.createBatch).mockResolvedValue(77);
    givenConfigured(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows Loading... on initial load, then renders the page', async () => {
    renderPage();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'AI 일괄 실행' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('starts a batch run from the modal and navigates to /automation (registry_v31)', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'AI 일괄 실행' }));
    expect(screen.getByText('실행 범위를 선택하세요:')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '실행' }));

    expect(await screen.findByText('Automation 페이지')).toBeInTheDocument();
    expect(agentExecutionApi.createBatch).toHaveBeenCalledTimes(1);
    expect(agentExecutionApi.createBatch).toHaveBeenCalledWith(10, 200, 'PHASE_ALL');
  });

  describe('result Priority (registry_v32 Step 2)', () => {
    it('shows the Priority select only on FAIL rows', async () => {
      givenResults(failResult, passResult);
      renderPage();

      await screen.findByText('회원가입');
      expect(screen.getAllByTestId('result-priority-select')).toHaveLength(1);
    });

    it('shows 확인 필요 when the priority is Unknown', async () => {
      givenResults(failResult);
      renderPage();

      const select = await screen.findByTestId('result-priority-select');
      expect(select).toHaveValue('');
      expect(within(select).getByRole('option', { name: '확인 필요' })).toBeInTheDocument();
    });

    it('shows the confirmed priority without the 확인 필요 option', async () => {
      givenResults({ ...failResult, priority: TicketPriority.HIGH });
      renderPage();

      const select = await screen.findByTestId('result-priority-select');
      expect(select).toHaveValue('HIGH');
      expect(within(select).queryByRole('option', { name: '확인 필요' })).not.toBeInTheDocument();
    });

    it('saves a picked priority with the current status and keeps the comment untouched', async () => {
      const user = userEvent.setup();
      givenResults(failResult);
      vi.mocked(testResultApi.updateResult).mockResolvedValue({ ...failResult, priority: TicketPriority.HIGHEST });
      renderPage();

      await user.selectOptions(await screen.findByTestId('result-priority-select'), 'HIGHEST');

      expect(testResultApi.updateResult).toHaveBeenCalledWith(100, 1, RunResultStatus.FAIL, undefined, 'HIGHEST');
      await waitFor(() => expect(screen.getByTestId('result-priority-select')).toHaveValue('HIGHEST'));
      // picking a priority does not expand the row
      expect(screen.queryByTestId('result-comment')).not.toBeInTheDocument();
    });
  });

  describe('result comment (AI reason)', () => {
    it('shows a one-line preview on collapsed FAIL rows only', async () => {
      givenResults(failResult, passResult);
      renderPage();

      const preview = await screen.findByTestId('result-comment-preview');
      expect(preview.textContent).toBe(AI_REASON);
      expect(screen.getAllByTestId('result-comment-preview')).toHaveLength(1);
      expect(screen.queryByText('통과 메모')).not.toBeInTheDocument();
    });

    it('shows a preview on RETEST rows too', async () => {
      givenResults({ ...failResult, status: RunResultStatus.RETEST, comment: '판정 불가' });
      renderPage();

      expect(await screen.findByTestId('result-comment-preview')).toHaveTextContent('판정 불가');
    });

    it('shows the full comment under 실행 결과 when expanded', async () => {
      const user = userEvent.setup();
      givenResults(failResult);
      renderPage();

      await user.click(await screen.findByTestId('result-comment-preview'));

      expect(screen.getByText('실행 결과')).toBeInTheDocument();
      expect(screen.getByTestId('result-comment').textContent).toBe(AI_REASON);
      expect(screen.queryByTestId('result-comment-preview')).not.toBeInTheDocument();
    });

    it('omits 실행 결과 when there is no comment', async () => {
      const user = userEvent.setup();
      givenResults({ ...failResult, comment: null });
      renderPage();

      await user.click(await screen.findByText('로그인 실패'));

      expect(screen.getByRole('button', { name: '+ 티켓 추가' })).toBeInTheDocument();
      expect(screen.queryByTestId('result-comment')).not.toBeInTheDocument();
      expect(screen.queryByTestId('result-comment-preview')).not.toBeInTheDocument();
    });
  });

  describe('ticket dialog (registry_v32 Step 3)', () => {
    it('warns and disables publishing when Notion is not configured', async () => {
      const user = userEvent.setup();
      givenConfigured(false);
      givenResults({ ...failResult, priority: TicketPriority.HIGH });
      renderPage();

      const dialog = await openTicketDialog(user, '로그인 실패');

      expect(within(dialog).getByText('버그 티켓 발행 (Notion)')).toBeInTheDocument();
      expect(within(dialog).getByTestId('ticket-config-warning')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: '티켓 발행' })).toBeDisabled();
    });

    it('treats a failed config lookup as not configured', async () => {
      const user = userEvent.setup();
      vi.mocked(ticketApi.getConfig).mockRejectedValue(new Error('network'));
      givenResults({ ...failResult, priority: TicketPriority.HIGH });
      renderPage();

      const dialog = await openTicketDialog(user, '로그인 실패');

      expect(within(dialog).getByTestId('ticket-config-warning')).toBeInTheDocument();
    });

    it('defaults the ticket priority to the result priority', async () => {
      const user = userEvent.setup();
      givenResults({ ...failResult, priority: TicketPriority.HIGHEST });
      renderPage();

      const dialog = await openTicketDialog(user, '로그인 실패');

      expect(within(dialog).getByRole('combobox')).toHaveValue('HIGHEST');
      await waitFor(() => expect(within(dialog).getByRole('button', { name: '티켓 발행' })).toBeEnabled());
      expect(within(dialog).queryByTestId('ticket-config-warning')).not.toBeInTheDocument();
    });

    it('requires picking a priority when the result priority is Unknown, then confirms it locally', async () => {
      const user = userEvent.setup();
      givenResults(failResult);
      vi.mocked(ticketApi.create).mockResolvedValue(makeTicket({}));
      renderPage();

      const dialog = await openTicketDialog(user, '로그인 실패');
      const prioritySelect = within(dialog).getByRole('combobox');
      expect(prioritySelect).toHaveValue('');
      expect(within(prioritySelect).getByRole('option', { name: 'Priority 선택' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: '티켓 발행' })).toBeDisabled();

      await user.selectOptions(prioritySelect, 'HIGH');
      await waitFor(() => expect(within(dialog).getByRole('button', { name: '티켓 발행' })).toBeEnabled());
      await user.click(within(dialog).getByRole('button', { name: '티켓 발행' }));

      expect(ticketApi.create).toHaveBeenCalledWith(
        100,
        1,
        'FAIL: 로그인 실패',
        'Phase: Phase 1\nVersion: v1.0',
        'HIGH',
        window.location.href
      );
      await waitFor(() => expect(screen.queryByTestId('ticket-dialog')).not.toBeInTheDocument());
      expect(screen.getByTestId('result-priority-select')).toHaveValue('HIGH');
    });

    it('shows the server message when publishing fails', async () => {
      const user = userEvent.setup();
      givenResults({ ...failResult, priority: TicketPriority.HIGH });
      vi.mocked(ticketApi.create).mockRejectedValue(new Error('Notion 연동 실패: HTTP 404 — Could not find database'));
      renderPage();

      const dialog = await openTicketDialog(user, '로그인 실패');
      await waitFor(() => expect(within(dialog).getByRole('button', { name: '티켓 발행' })).toBeEnabled());
      await user.click(within(dialog).getByRole('button', { name: '티켓 발행' }));

      expect(await within(dialog).findByText('Notion 연동 실패: HTTP 404 — Could not find database')).toBeInTheDocument();
      expect(screen.getByTestId('ticket-dialog')).toBeInTheDocument();
    });

    it('opens the dialog with the TC-mapped priority when a row is set to FAIL', async () => {
      const user = userEvent.setup();
      givenResults(passResult);
      vi.mocked(testResultApi.updateResult).mockResolvedValue({
        ...passResult,
        status: RunResultStatus.FAIL,
        priority: TicketPriority.MEDIUM,
        executedBy: 'HUMAN',
      });
      renderPage();

      await screen.findByText('회원가입');
      await user.click(screen.getByTitle('Fail'));

      expect(testResultApi.updateResult).toHaveBeenCalledWith(100, 2, RunResultStatus.FAIL);
      const dialog = await screen.findByTestId('ticket-dialog');
      expect(within(dialog).getByRole('combobox')).toHaveValue('MEDIUM');
    });

    it('lists tickets with issueKey for Jira and a Notion label for Notion', async () => {
      const user = userEvent.setup();
      givenResults(failResult);
      vi.mocked(ticketApi.getByResultId).mockResolvedValue([
        makeTicket({ id: 1, summary: 'Notion 버그' }),
        makeTicket({
          id: 2,
          issueKey: 'AT-7',
          issueUrl: 'https://jira.example.com/browse/AT-7',
          tracker: TicketTracker.JIRA,
          summary: 'Jira 버그',
          status: '완료',
        }),
      ]);
      renderPage();

      await user.click(await screen.findByText('로그인 실패'));

      expect(await screen.findByText('AT-7')).toBeInTheDocument();
      expect(screen.getByText('Notion')).toBeInTheDocument();
      expect(screen.getByTitle('Notion에서 보기')).toHaveAttribute('href', 'https://www.notion.so/page-1');
      expect(screen.getByTitle('Jira에서 보기')).toHaveAttribute('href', 'https://jira.example.com/browse/AT-7');
      expect(ticketApi.getByResultId).toHaveBeenCalledWith(100, 1);
    });
  });
});
