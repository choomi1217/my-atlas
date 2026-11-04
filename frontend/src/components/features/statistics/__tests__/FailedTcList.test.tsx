import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FailedTcList } from '../FailedTcList';
import { TicketPriority } from '@/types/features';
import type { FailedTcInfo, Segment } from '@/types/features';

const failedTc = (overrides: Partial<FailedTcInfo>): FailedTcInfo => ({
  testResultId: 1,
  testCaseId: 10,
  testCaseTitle: 'TC',
  testCasePath: [],
  phaseId: 201,
  phaseName: '1차',
  priority: TicketPriority.HIGH,
  comment: null,
  ...overrides,
});

const unknownTc = failedTc({
  testResultId: 1,
  testCaseId: 10,
  testCaseTitle: '로그인 실패',
  phaseName: '2차',
  priority: null,
  comment: '[AI FAIL] #2 FAIL: 버튼 없음',
});
const highestTc = failedTc({ testResultId: 2, testCaseId: 11, testCaseTitle: '결제 실패', priority: TicketPriority.HIGHEST });

describe('FailedTcList', () => {
  it('shows the empty message when there are no failed TCs', () => {
    render(<FailedTcList failedTcs={[]} onSelect={vi.fn()} />);

    expect(screen.getByText('Failed TC가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByTestId('failed-tc-row')).not.toBeInTheDocument();
  });

  it('renders one row per failed TC with title, phase and AI reason', () => {
    render(<FailedTcList failedTcs={[unknownTc, highestTc]} onSelect={vi.fn()} />);

    const rows = screen.getAllByTestId('failed-tc-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('로그인 실패')).toBeInTheDocument();
    expect(within(rows[0]).getByText('2차')).toBeInTheDocument();
    expect(within(rows[0]).getByText('[AI FAIL] #2 FAIL: 버튼 없음')).toBeInTheDocument();
    expect(within(rows[1]).getByText('결제 실패')).toBeInTheDocument();
    expect(within(rows[1]).getByText('HIGHEST')).toBeInTheDocument();
  });

  it('shows the 확인 필요 badge for unknown priority and counts it in the header', () => {
    render(<FailedTcList failedTcs={[unknownTc, highestTc]} onSelect={vi.fn()} />);

    const rows = screen.getAllByTestId('failed-tc-row');
    expect(within(rows[0]).getByText('확인 필요')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('확인 필요')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Failed TCs (2) · 확인 필요 1');
  });

  it('omits the 확인 필요 count when every priority is confirmed', () => {
    render(<FailedTcList failedTcs={[highestTc]} onSelect={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Failed TCs (1)');
    expect(screen.queryByText(/확인 필요/)).not.toBeInTheDocument();
  });

  it('resolves the segment path names', () => {
    const segments: Segment[] = [
      { id: 1, name: '회원', productId: 10, parentId: null, orderIndex: 0 },
      { id: 2, name: '로그인', productId: 10, parentId: 1, orderIndex: 0 },
    ];
    render(
      <FailedTcList
        failedTcs={[failedTc({ testCasePath: [1, 2, 99] })]}
        segments={segments}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('회원 > 로그인 > ?')).toBeInTheDocument();
  });

  it('calls onSelect with the clicked TC', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FailedTcList failedTcs={[unknownTc, highestTc]} onSelect={onSelect} />);

    await user.click(screen.getByText('결제 실패'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(highestTc);
  });
});
