import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import AgentLiveFlow from '../AgentLiveFlow';
import type { AgentLiveProgress } from '@/types/features';

const judgingProgress: AgentLiveProgress = {
  testCaseId: 42,
  testCaseTitle: '로그인 성공 시 대시보드 이동',
  tcIndex: 1,
  tcTotal: 1,
  phase: 'JUDGING',
  precondition: { text: '로그인 > 이메일 로그인', status: 'DONE' },
  currentStep: 3,
  steps: [
    {
      order: 1,
      action: '이메일 입력',
      expected: '입력값 표시',
      status: 'PASS',
      judgment: '입력값이 보인다',
    },
    {
      order: 2,
      action: '비밀번호 입력',
      expected: '마스킹 표시',
      status: 'FAIL',
      judgment: '평문으로 보인다',
    },
    {
      order: 3,
      action: '로그인 버튼 클릭',
      expected: '대시보드로 이동',
      status: 'JUDGING',
      judgment: null,
    },
  ],
};

describe('AgentLiveFlow', () => {
  it('renders header with TC index, id and title', () => {
    render(<AgentLiveFlow progress={judgingProgress} />);

    const header = screen.getByTestId('agent-live-tc');
    expect(header).toHaveTextContent('TC 1/1');
    expect(header).toHaveTextContent('T42');
    expect(header).toHaveTextContent('로그인 성공 시 대시보드 이동');
  });

  it('renders step nodes with status and label', () => {
    render(<AgentLiveFlow progress={judgingProgress} />);

    const n1 = screen.getByTestId('agent-live-node-1');
    const n2 = screen.getByTestId('agent-live-node-2');
    const n3 = screen.getByTestId('agent-live-node-3');
    expect(n1).toHaveAttribute('data-status', 'PASS');
    expect(n2).toHaveAttribute('data-status', 'FAIL');
    expect(n3).toHaveAttribute('data-status', 'JUDGING');
    expect(n1).toHaveTextContent('✓ PASS');
    expect(n2).toHaveTextContent('✕ FAIL');
    expect(n3).toHaveTextContent('판정 중');
    expect(n1).toHaveTextContent('Step 1');
  });

  it('renders DONE precondition node', () => {
    render(<AgentLiveFlow progress={judgingProgress} />);

    const pre = screen.getByTestId('agent-live-node-pre');
    expect(pre).toHaveAttribute('data-status', 'DONE');
    expect(pre).toHaveTextContent('✓ 완료');
    expect(pre).toHaveAttribute('title', '경로: 로그인 > 이메일 로그인');
  });

  it('renders INCOMPLETE precondition node as not reached (no false green)', () => {
    render(
      <AgentLiveFlow
        progress={{
          ...judgingProgress,
          precondition: { text: '로그인 > 이메일 로그인', status: 'INCOMPLETE' },
        }}
      />
    );

    const pre = screen.getByTestId('agent-live-node-pre');
    expect(pre).toHaveAttribute('data-status', 'INCOMPLETE');
    expect(pre).toHaveTextContent('⚠ 미도달');
    expect(pre).not.toHaveTextContent('✓ 완료');
  });

  it('shows current step detail while judging', () => {
    render(<AgentLiveFlow progress={judgingProgress} />);

    const detail = screen.getByTestId('agent-live-detail');
    expect(detail).toHaveTextContent('Step 3/3 · 기대 결과 판정 중');
    expect(detail).toHaveTextContent('로그인 버튼 클릭');
    expect(detail).toHaveTextContent('대시보드로 이동');
  });

  it('puts action/expected/judgment in node tooltips', () => {
    render(<AgentLiveFlow progress={judgingProgress} />);

    expect(screen.getByTestId('agent-live-node-1')).toHaveAttribute(
      'title',
      '동작: 이메일 입력\n기대 결과: 입력값 표시\n판정: 입력값이 보인다'
    );
    const pendingTitle = screen
      .getByTestId('agent-live-node-3')
      .getAttribute('title');
    expect(pendingTitle).toContain('동작: 로그인 버튼 클릭');
    expect(pendingTitle).toContain('기대 결과: 대시보드로 이동');
    expect(pendingTitle).not.toContain('판정:');
  });

  it('shows precondition detail while navigating to precondition', () => {
    render(
      <AgentLiveFlow
        progress={{
          ...judgingProgress,
          phase: 'PRECONDITION',
          precondition: { text: '설정 > 계정', status: 'RUNNING' },
          currentStep: null,
          steps: judgingProgress.steps.map((s) => ({
            ...s,
            status: 'PENDING' as const,
            judgment: null,
          })),
        }}
      />
    );

    const detail = screen.getByTestId('agent-live-detail');
    expect(detail).toHaveTextContent('전제조건 화면으로 이동 중');
    expect(detail).toHaveTextContent('설정 > 계정');
    const pre = screen.getByTestId('agent-live-node-pre');
    expect(pre).toHaveAttribute('data-status', 'RUNNING');
    expect(pre).toHaveTextContent('이동 중');
    expect(screen.getByTestId('agent-live-node-1')).toHaveTextContent('대기');
  });

  it('omits precondition node when precondition is null', () => {
    render(
      <AgentLiveFlow progress={{ ...judgingProgress, precondition: null }} />
    );

    expect(screen.queryByTestId('agent-live-node-pre')).not.toBeInTheDocument();
    expect(screen.getByTestId('agent-live-node-1')).toBeInTheDocument();
  });

  it('shows acting label and detail for an ACTING step', () => {
    render(
      <AgentLiveFlow
        progress={{
          ...judgingProgress,
          phase: 'ACTING',
          currentStep: 2,
          steps: [
            judgingProgress.steps[0],
            { ...judgingProgress.steps[1], status: 'ACTING', judgment: null },
            { ...judgingProgress.steps[2], status: 'PENDING' },
          ],
        }}
      />
    );

    const n2 = screen.getByTestId('agent-live-node-2');
    expect(n2).toHaveAttribute('data-status', 'ACTING');
    expect(n2).toHaveTextContent('수행 중');
    expect(screen.getByTestId('agent-live-detail')).toHaveTextContent(
      'Step 2/3 · 동작 수행 중'
    );
  });

  it('renders no detail when current step is not found', () => {
    render(
      <AgentLiveFlow
        progress={{ ...judgingProgress, phase: 'ACTING', currentStep: null }}
      />
    );

    expect(screen.queryByTestId('agent-live-detail')).not.toBeInTheDocument();
  });

  // --- registry_v28 #5: node summary + click-to-inspect ---

  it('shows the step action and precondition path as node summaries', () => {
    render(<AgentLiveFlow progress={judgingProgress} />);

    expect(screen.getByTestId('agent-live-node-1-summary')).toHaveTextContent(
      '이메일 입력'
    );
    expect(screen.getByTestId('agent-live-node-2-summary')).toHaveTextContent(
      '비밀번호 입력'
    );
    expect(screen.getByTestId('agent-live-node-pre-summary')).toHaveTextContent(
      '로그인 > 이메일 로그인'
    );
    expect(screen.getByTestId('agent-live-node-2')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(
      screen.queryByTestId('agent-live-detail-follow')
    ).not.toBeInTheDocument();
  });

  it('shows the clicked FAIL node in the detail card and toggles back on second click', async () => {
    const user = userEvent.setup();
    render(<AgentLiveFlow progress={judgingProgress} />);

    const n2 = screen.getByTestId('agent-live-node-2');
    await user.click(n2);

    const detail = within(screen.getByTestId('agent-live-detail'));
    expect(detail.getByText('Step 2/3 · ✕ FAIL')).toBeInTheDocument();
    expect(detail.getByText('동작')).toBeInTheDocument();
    expect(detail.getByText('비밀번호 입력')).toBeInTheDocument();
    expect(detail.getByText('기대 결과')).toBeInTheDocument();
    expect(detail.getByText('마스킹 표시')).toBeInTheDocument();
    expect(detail.getByText('판정')).toBeInTheDocument();
    expect(detail.getByText('평문으로 보인다')).toBeInTheDocument();
    expect(n2).toHaveAttribute('aria-pressed', 'true');
    expect(n2).toHaveClass('outline-gray-500');
    expect(screen.getByTestId('agent-live-detail-follow')).toHaveTextContent(
      '현재 Step 보기'
    );

    await user.click(n2);

    const back = screen.getByTestId('agent-live-detail');
    expect(back).toHaveTextContent('Step 3/3 · 기대 결과 판정 중');
    expect(within(back).getByText('로그인 버튼 클릭')).toBeInTheDocument();
    expect(within(back).queryByText('판정')).not.toBeInTheDocument();
    expect(n2).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.queryByTestId('agent-live-detail-follow')
    ).not.toBeInTheDocument();
  });

  it('clears the selection with the 현재 Step 보기 button', async () => {
    const user = userEvent.setup();
    render(<AgentLiveFlow progress={judgingProgress} />);

    await user.click(screen.getByTestId('agent-live-node-1'));
    expect(screen.getByTestId('agent-live-detail')).toHaveTextContent(
      'Step 1/3 · ✓ PASS'
    );

    await user.click(screen.getByTestId('agent-live-detail-follow'));

    expect(screen.getByTestId('agent-live-detail')).toHaveTextContent(
      'Step 3/3 · 기대 결과 판정 중'
    );
    expect(screen.getByTestId('agent-live-node-1')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(
      screen.queryByTestId('agent-live-detail-follow')
    ).not.toBeInTheDocument();
  });

  it('shows precondition detail when the precondition node is clicked', async () => {
    const user = userEvent.setup();
    render(<AgentLiveFlow progress={judgingProgress} />);

    const pre = screen.getByTestId('agent-live-node-pre');
    await user.click(pre);

    const detail = within(screen.getByTestId('agent-live-detail'));
    expect(detail.getByText('전제조건 · ✓ 완료')).toBeInTheDocument();
    expect(detail.getByText('경로')).toBeInTheDocument();
    expect(detail.getByText('로그인 > 이메일 로그인')).toBeInTheDocument();
    expect(detail.queryByText('동작')).not.toBeInTheDocument();
    expect(pre).toHaveAttribute('aria-pressed', 'true');
  });

  it('drops the selection when testCaseId changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AgentLiveFlow progress={judgingProgress} />);

    await user.click(screen.getByTestId('agent-live-node-2'));
    expect(screen.getByTestId('agent-live-detail')).toHaveTextContent(
      'Step 2/3 · ✕ FAIL'
    );

    rerender(
      <AgentLiveFlow
        progress={{
          ...judgingProgress,
          testCaseId: 43,
          testCaseTitle: '로그아웃',
          tcIndex: 2,
          tcTotal: 2,
          steps: [
            judgingProgress.steps[0],
            judgingProgress.steps[1],
            {
              ...judgingProgress.steps[2],
              action: '로그아웃 버튼 클릭',
              expected: '로그인 화면 이동',
            },
          ],
        }}
      />
    );

    const detail = screen.getByTestId('agent-live-detail');
    expect(detail).toHaveTextContent('Step 3/3 · 기대 결과 판정 중');
    expect(within(detail).getByText('로그아웃 버튼 클릭')).toBeInTheDocument();
    expect(within(detail).getByText('로그인 화면 이동')).toBeInTheDocument();
    expect(detail).not.toHaveTextContent('✕ FAIL');
    expect(screen.getByTestId('agent-live-node-2')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(
      screen.queryByTestId('agent-live-detail-follow')
    ).not.toBeInTheDocument();
  });

  it('renders the selected detail in the dark variant', async () => {
    const user = userEvent.setup();
    render(<AgentLiveFlow progress={judgingProgress} variant="dark" />);

    const n2 = screen.getByTestId('agent-live-node-2');
    await user.click(n2);

    const detail = within(screen.getByTestId('agent-live-detail'));
    expect(detail.getByText('Step 2/3 · ✕ FAIL')).toBeInTheDocument();
    expect(detail.getByText('평문으로 보인다')).toBeInTheDocument();
    expect(n2).toHaveAttribute('aria-pressed', 'true');
    expect(n2).toHaveClass('outline-white/70');
    expect(screen.getByTestId('agent-live-detail-follow')).toBeInTheDocument();
  });
});
