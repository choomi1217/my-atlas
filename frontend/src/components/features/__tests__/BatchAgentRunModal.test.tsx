import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import BatchAgentRunModal from '../BatchAgentRunModal';
import { agentExecutionApi } from '@/api/features';

vi.mock('@/api/features', () => ({
  agentExecutionApi: { createBatch: vi.fn() },
}));

const CONFLICT_MESSAGE = '같은 Phase에서 대기·실행 중인 Job(#9)과 TC가 겹칩니다';

const conflictError = Object.assign(new Error('Request failed with status code 409'), {
  isAxiosError: true,
  response: { status: 409, data: { message: CONFLICT_MESSAGE } },
});

const renderModal = (onClose = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={['/phase']}>
      <Routes>
        <Route
          path="/phase"
          element={
            <BatchAgentRunModal productId={10} phaseId={200} phaseName="1차" onClose={onClose} />
          }
        />
        <Route path="/automation" element={<div>Automation 페이지</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('BatchAgentRunModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('selects 전체 by default', () => {
    renderModal();

    expect(screen.getByRole('radio', { name: /전체/ })).toBeChecked();
  });

  it.each([
    ['전체', 'PHASE_ALL'],
    ['Untested만', 'PHASE_UNTESTED'],
    ['이전 FAIL만', 'PHASE_PREV_FAIL'],
  ])('creates the job with %s and navigates to /automation', async (label, scope) => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.createBatch).mockResolvedValue(77);
    renderModal();

    await user.click(screen.getByRole('radio', { name: new RegExp(label) }));
    await user.click(screen.getByRole('button', { name: '실행' }));

    expect(await screen.findByText('Automation 페이지')).toBeInTheDocument();
    expect(agentExecutionApi.createBatch).toHaveBeenCalledWith(10, 200, scope);
  });

  it('stays in the modal and shows the message on 409', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.createBatch).mockRejectedValue(conflictError);
    renderModal();

    await user.click(screen.getByRole('button', { name: '실행' }));

    expect(await screen.findByTestId('batch-agent-error')).toHaveTextContent(CONFLICT_MESSAGE);
    expect(screen.getByRole('button', { name: '실행' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'AI 일괄 실행' })).toBeInTheDocument();
    expect(screen.queryByText('Automation 페이지')).not.toBeInTheDocument();
  });

  it('calls onClose without creating a job when cancelled', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(agentExecutionApi.createBatch).not.toHaveBeenCalled();
  });
});
