import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AgentStepScreenshot from '../AgentStepScreenshot';
import { agentExecutionApi } from '@/api/features';

vi.mock('@/api/features', () => ({
  agentExecutionApi: { getScreenshot: vi.fn() },
}));

const blob = new Blob(['jpeg'], { type: 'image/jpeg' });

// jsdom has no URL.createObjectURL / revokeObjectURL — stub and restore.
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
const createObjectURL = vi.fn<(obj: Blob | MediaSource) => string>(() => 'blob:shot-1');
const revokeObjectURL = vi.fn<(url: string) => void>();

const renderShot = (active = false) =>
  render(
    <AgentStepScreenshot jobId={1} testCaseId={2} stepOrder={3} active={active} settled={!active} />
  );

describe('AgentStepScreenshot', () => {
  beforeEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    vi.useRealTimers();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.clearAllMocks();
  });

  it('renders nothing when there is no screenshot', async () => {
    vi.mocked(agentExecutionApi.getScreenshot).mockResolvedValue(null);

    const { container } = renderShot();

    await waitFor(() =>
      expect(agentExecutionApi.getScreenshot).toHaveBeenCalledWith(1, 2, 3)
    );
    expect(container).toBeEmptyDOMElement();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('renders nothing when the fetch fails', async () => {
    vi.mocked(agentExecutionApi.getScreenshot).mockRejectedValue(new Error('network'));

    const { container } = renderShot();

    await waitFor(() => expect(agentExecutionApi.getScreenshot).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a thumbnail when a screenshot exists', async () => {
    vi.mocked(agentExecutionApi.getScreenshot).mockResolvedValue(blob);

    renderShot();

    expect(await screen.findByRole('img', { name: 'Step 3 스크린샷' })).toHaveAttribute(
      'src',
      'blob:shot-1'
    );
  });

  it('revokes the object URL on unmount', async () => {
    vi.mocked(agentExecutionApi.getScreenshot).mockResolvedValue(blob);
    const { unmount } = renderShot();
    await screen.findByTestId('automation-step-screenshot');

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:shot-1');
  });

  it('opens zoom on click and closes it with Escape', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.getScreenshot).mockResolvedValue(blob);
    renderShot();

    await user.click(await screen.findByTestId('automation-step-screenshot'));
    expect(screen.getByTestId('automation-step-screenshot-zoom')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('automation-step-screenshot-zoom')).not.toBeInTheDocument();
  });

  it('closes zoom on overlay click', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.getScreenshot).mockResolvedValue(blob);
    renderShot();

    await user.click(await screen.findByTestId('automation-step-screenshot'));
    await user.click(screen.getByTestId('automation-step-screenshot-zoom'));

    expect(screen.queryByTestId('automation-step-screenshot-zoom')).not.toBeInTheDocument();
  });

  it('checks once and stops when the step is settled but has no screenshot', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(agentExecutionApi.getScreenshot).mockResolvedValue(null);

    render(
      <AgentStepScreenshot jobId={1} testCaseId={2} stepOrder={3} active settled />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(agentExecutionApi.getScreenshot).toHaveBeenCalledTimes(1);
  });

  it('retries while active until the screenshot appears, then stops', async () => {
    vi.useFakeTimers();
    vi.mocked(agentExecutionApi.getScreenshot)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(blob);

    renderShot(true);

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.queryByTestId('automation-step-screenshot')).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByTestId('automation-step-screenshot')).toBeInTheDocument();
    expect(agentExecutionApi.getScreenshot).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(agentExecutionApi.getScreenshot).toHaveBeenCalledTimes(2);
  });
});
