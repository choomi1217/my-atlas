import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AgentLiveView from '../AgentLiveView';
import { agentExecutionApi } from '@/api/features';

vi.mock('@/api/features', () => ({
  agentExecutionApi: { getFrame: vi.fn() },
}));

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
});
