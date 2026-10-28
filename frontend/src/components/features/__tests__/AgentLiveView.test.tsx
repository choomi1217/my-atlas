import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AgentLiveView from '../AgentLiveView';
import { agentExecutionApi } from '@/api/features';
import type { AgentLiveProgress } from '@/types/features';

vi.mock('@/api/features', () => ({
  agentExecutionApi: { getFrame: vi.fn(), getProgress: vi.fn() },
}));

const progress: AgentLiveProgress = {
  testCaseId: 42,
  testCaseTitle: '로그인 성공',
  tcIndex: 1,
  tcTotal: 2,
  phase: 'ACTING',
  precondition: null,
  currentStep: 1,
  steps: [
    {
      order: 1,
      action: '로그인 버튼 클릭',
      expected: '대시보드 이동',
      status: 'ACTING',
      judgment: null,
    },
  ],
};

// jsdom has no URL.createObjectURL / revokeObjectURL — stub and restore.
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
const createObjectURL = vi.fn<(obj: Blob | MediaSource) => string>(
  () => 'blob:frame-1'
);
const revokeObjectURL = vi.fn<(url: string) => void>();

describe('AgentLiveView', () => {
  beforeEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(null);
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.clearAllMocks();
  });

  it('shows the frame image when getFrame returns a blob', async () => {
    vi.mocked(agentExecutionApi.getFrame).mockResolvedValue(
      new Blob(['png'], { type: 'image/png' })
    );

    render(<AgentLiveView jobId={7} active />);

    const img = await screen.findByRole('img', { name: 'AI 실행 화면' });
    expect(img).toHaveAttribute('src', 'blob:frame-1');
    expect(img).toHaveAttribute('data-testid', 'agent-live-frame');
    expect(agentExecutionApi.getFrame).toHaveBeenCalledWith(7);
    expect(screen.queryByTestId('agent-live-waiting')).not.toBeInTheDocument();
  });

  it('shows waiting text when no frame is available', async () => {
    vi.mocked(agentExecutionApi.getFrame).mockResolvedValue(null);

    render(<AgentLiveView jobId={7} active />);

    await waitFor(() => expect(agentExecutionApi.getFrame).toHaveBeenCalledWith(7));
    expect(screen.getByTestId('agent-live-waiting')).toHaveTextContent('화면 수신 대기 중…');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('renders nothing and does not poll when inactive', () => {
    const { container } = render(<AgentLiveView jobId={7} active={false} />);

    expect(container).toBeEmptyDOMElement();
    expect(agentExecutionApi.getFrame).not.toHaveBeenCalled();
  });

  it('revokes the object URL on unmount', async () => {
    vi.mocked(agentExecutionApi.getFrame).mockResolvedValue(
      new Blob(['png'], { type: 'image/png' })
    );

    const { unmount } = render(<AgentLiveView jobId={7} active />);
    await screen.findByRole('img', { name: 'AI 실행 화면' });

    // Ignore any revoke from a replaced frame; only the unmount cleanup matters here.
    revokeObjectURL.mockClear();
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:frame-1');
  });

  // --- registry_v27: progress flow + zoom ---

  it('does not render the flow when there is no progress', async () => {
    vi.mocked(agentExecutionApi.getFrame).mockResolvedValue(null);

    render(<AgentLiveView jobId={7} active />);

    await waitFor(() =>
      expect(agentExecutionApi.getProgress).toHaveBeenCalledWith(7)
    );
    expect(screen.queryByTestId('agent-live-flow')).not.toBeInTheDocument();
  });

  it('renders the progress flow above the frame', async () => {
    vi.mocked(agentExecutionApi.getFrame).mockResolvedValue(
      new Blob(['png'], { type: 'image/png' })
    );
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(progress);

    render(<AgentLiveView jobId={7} active />);

    const flow = await screen.findByTestId('agent-live-flow');
    const frame = await screen.findByTestId('agent-live-frame');
    expect(agentExecutionApi.getProgress).toHaveBeenCalledWith(7);
    expect(screen.getByTestId('agent-live-tc')).toHaveTextContent('TC 1/2');
    expect(
      flow.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('still shows the frame when getProgress rejects', async () => {
    vi.mocked(agentExecutionApi.getFrame).mockResolvedValue(
      new Blob(['png'], { type: 'image/png' })
    );
    vi.mocked(agentExecutionApi.getProgress).mockRejectedValue(
      new Error('network')
    );

    render(<AgentLiveView jobId={7} active />);

    expect(await screen.findByTestId('agent-live-frame')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-live-flow')).not.toBeInTheDocument();
  });

  it('opens zoom overlay and closes it with Escape and overlay click', async () => {
    const user = userEvent.setup();
    vi.mocked(agentExecutionApi.getFrame).mockResolvedValue(
      new Blob(['png'], { type: 'image/png' })
    );
    vi.mocked(agentExecutionApi.getProgress).mockResolvedValue(progress);

    render(<AgentLiveView jobId={7} active />);
    const openButton = await screen.findByTestId('agent-live-zoom-open');
    await screen.findByTestId('agent-live-flow');
    expect(screen.queryByTestId('agent-live-zoom')).not.toBeInTheDocument();

    await user.click(openButton);
    const overlay = screen.getByTestId('agent-live-zoom');
    expect(overlay).toBeVisible();
    expect(within(overlay).getByTestId('agent-live-flow')).toBeInTheDocument();
    expect(
      within(overlay).getByRole('img', { name: 'AI 실행 화면 확대' })
    ).toHaveAttribute('src', 'blob:frame-1');

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('agent-live-zoom')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('agent-live-zoom-open'));
    await user.click(screen.getByTestId('agent-live-zoom'));
    expect(screen.queryByTestId('agent-live-zoom')).not.toBeInTheDocument();
  });
});
