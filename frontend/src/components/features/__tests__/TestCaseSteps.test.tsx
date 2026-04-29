import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TestCaseSteps from '../TestCaseSteps';
import { TestStep } from '@/types/features';

vi.mock('../ImageRefText', () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

describe('TestCaseSteps', () => {
  const steps: TestStep[] = [
    { order: 0, action: 'click button', expected: 'modal opens' },
    { order: 1, action: 'enter text', expected: 'text appears' },
  ];

  it('각 step 이 [번호 뱃지] | ACTION | STEP EXPECTED 의 3열 grid 로 렌더된다', () => {
    render(<TestCaseSteps steps={steps} />);
    const rows = screen.getAllByTestId('tc-step-row');
    expect(rows).toHaveLength(2);

    rows.forEach((row, idx) => {
      expect(within(row).getByText(String(idx + 1))).toBeInTheDocument();
      expect(within(row).getByText('Action')).toBeInTheDocument();
      expect(within(row).getByText('Step Expected')).toBeInTheDocument();
    });
  });

  it('번호 뱃지가 1부터 순차적으로 부여된다', () => {
    render(<TestCaseSteps steps={steps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('각 step 의 action / expected 텍스트가 노출된다', () => {
    render(<TestCaseSteps steps={steps} />);
    expect(screen.getByText('click button')).toBeInTheDocument();
    expect(screen.getByText('modal opens')).toBeInTheDocument();
    expect(screen.getByText('enter text')).toBeInTheDocument();
    expect(screen.getByText('text appears')).toBeInTheDocument();
  });

  it('steps 가 빈 배열이면 아무 것도 렌더하지 않는다', () => {
    const { container } = render(<TestCaseSteps steps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('Steps grid row 가 grid layout class 를 갖는다', () => {
    render(<TestCaseSteps steps={steps} />);
    const row = screen.getAllByTestId('tc-step-row')[0];
    expect(row.className).toContain('grid');
  });
});
