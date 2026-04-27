import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TestCaseCard from '../TestCaseCard';
import { TestCase } from '@/types/features';

vi.mock('../ImageRefText', () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

const baseTC: TestCase = {
  id: 1,
  productId: 100,
  path: [],
  title: 'Login flow',
  description: 'Login flow description',
  preconditions: 'User is on login page',
  steps: [{ order: 0, action: 'click login', expected: 'redirected' }],
  expectedResults: ['User is logged in'],
  priority: 'HIGH',
  testType: 'FUNCTIONAL',
  status: 'ACTIVE',
  images: [],
  createdAt: '2026-04-27T00:00:00Z',
  updatedAt: '2026-04-27T00:00:00Z',
};

describe('TestCaseCard', () => {
  let onToggle: ReturnType<typeof vi.fn>;
  let onEdit: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggle = vi.fn();
    onEdit = vi.fn();
    onDelete = vi.fn();
  });

  const renderCard = (overrides: Partial<TestCase> = {}, isExpanded = false) =>
    render(
      <TestCaseCard
        testCase={{ ...baseTC, ...overrides }}
        isExpanded={isExpanded}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

  it('Header zone 에 제목/뱃지/Edit/Delete/Created 가 노출되고 Body 는 닫힌 상태', () => {
    renderCard();
    expect(screen.getByText('Login flow')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('FUNCTIONAL')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText(/Created:/)).toBeInTheDocument();
    // Body 는 닫혀있어야 함
    expect(screen.queryByTestId('tc-body')).not.toBeInTheDocument();
    expect(screen.queryByText('Login flow description')).not.toBeInTheDocument();
  });

  it('펼친 상태에서 Body 가 Definition List 구조로 렌더링된다', () => {
    renderCard({}, true);
    const body = screen.getByTestId('tc-body');
    expect(body).toBeInTheDocument();

    const dl = body.querySelector('dl');
    expect(dl).not.toBeNull();

    const dts = dl!.querySelectorAll('dt');
    expect(dts.length).toBeGreaterThanOrEqual(2);
    expect(Array.from(dts).some((dt) => dt.textContent === 'Description')).toBe(true);
    expect(Array.from(dts).some((dt) => dt.textContent === 'Preconditions')).toBe(true);
  });

  it('Final Expected Result 가 Steps 컴포넌트 다음(아래)에 위치한다', () => {
    renderCard({}, true);
    const stepsEl = screen.getByTestId('tc-steps');
    const finalEl = screen.getByTestId('tc-final-expected');

    // DOCUMENT_POSITION_FOLLOWING(4) 비트가 켜져있어야 finalEl 이 stepsEl 보다 뒤
    const position = stepsEl.compareDocumentPosition(finalEl);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Final Expected Result 영역에 green accent class 가 적용된다', () => {
    renderCard({}, true);
    const finalEl = screen.getByTestId('tc-final-expected');
    expect(finalEl.className).toContain('border-green-600');
    expect(finalEl.className).toContain('bg-green-50');
    expect(finalEl).toHaveTextContent('Final Expected Result');
  });

  it('expectedResults 가 빈 배열이면 Final Expected Result 영역을 렌더링하지 않는다', () => {
    renderCard({ expectedResults: [] }, true);
    expect(screen.queryByTestId('tc-final-expected')).not.toBeInTheDocument();
  });

  it('expectedResults 에 다중 항목이 있으면 ol > li 형태로 모두 렌더한다', () => {
    renderCard(
      { expectedResults: ['QA에 대한 올바른 대답 출력', 'MD 형식으로 대답 출력'] },
      true,
    );
    const list = screen.getByTestId('tc-final-expected-list');
    const items = screen.getAllByTestId('tc-final-expected-item');
    expect(list.tagName).toBe('OL');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('QA에 대한 올바른 대답 출력');
    expect(items[1]).toHaveTextContent('MD 형식으로 대답 출력');
  });

  it('Header 클릭 시 onToggle 콜백 호출', () => {
    renderCard();
    fireEvent.click(screen.getByText('Login flow'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('Edit/Delete 버튼 클릭 시 콜백을 올바른 인자로 호출한다', () => {
    renderCard();
    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1, title: 'Login flow' }));

    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith({ id: 1, title: 'Login flow' });
    // Edit/Delete 클릭은 stopPropagation 으로 onToggle 호출하지 않아야 함
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('priority 에 따라 카드 좌측 border 색상이 바뀐다', () => {
    const { rerender } = renderCard({ priority: 'HIGH' });
    expect(screen.getByTestId('tc-card').className).toContain('border-l-red-400');

    rerender(
      <TestCaseCard
        testCase={{ ...baseTC, priority: 'MEDIUM' }}
        isExpanded={false}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTestId('tc-card').className).toContain('border-l-yellow-400');

    rerender(
      <TestCaseCard
        testCase={{ ...baseTC, priority: 'LOW' }}
        isExpanded={false}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTestId('tc-card').className).toContain('border-l-gray-300');
  });
});
