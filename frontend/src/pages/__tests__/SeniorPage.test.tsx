import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SeniorPage from '../SeniorPage';

// Mock child components to isolate SeniorPage logic
vi.mock('@/components/senior/FaqView', () => ({
  default: ({ onSendToChat, onGoToChat }: { onSendToChat: (faq: unknown) => void; onGoToChat: () => void }) => (
    <div data-testid="faq-view">
      <button onClick={() => onSendToChat({ id: 1, title: 'FAQ 1', content: 'Content' })}>
        SendToChat
      </button>
      <button onClick={onGoToChat}>GoToChat</button>
    </div>
  ),
}));

vi.mock('@/components/senior/ChatView', () => ({
  default: () => <div data-testid="chat-view">ChatView</div>,
}));

vi.mock('@/hooks/useSeniorChat', () => ({
  useSeniorChat: () => ({
    messages: [],
    isStreaming: false,
    error: null,
    faqContext: null,
    setFaqContext: vi.fn(),
    sendMessage: vi.fn(),
    stopStreaming: vi.fn(),
    clearChat: vi.fn(),
  }),
}));

describe('SeniorPage', () => {
  it('renders with My Senior heading', () => {
    render(<SeniorPage />);
    expect(screen.getByText('My Senior')).toBeInTheDocument();
  });

  it('shows FAQ view by default', () => {
    render(<SeniorPage />);
    expect(screen.getByTestId('faq-view')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-view')).not.toBeInTheDocument();
  });

  it('switches to Chat view when button clicked', async () => {
    const user = userEvent.setup();
    render(<SeniorPage />);

    await user.click(screen.getByText('Chat →'));

    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    expect(screen.queryByTestId('faq-view')).not.toBeInTheDocument();
  });

  it('switches back to FAQ view', async () => {
    const user = userEvent.setup();
    render(<SeniorPage />);

    await user.click(screen.getByText('Chat →'));
    await user.click(screen.getByText('← FAQ'));

    expect(screen.getByTestId('faq-view')).toBeInTheDocument();
  });

  it('switches to Chat when SendToChat clicked in FaqView', async () => {
    const user = userEvent.setup();
    render(<SeniorPage />);

    await user.click(screen.getByText('SendToChat'));

    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });

  it('switches to Chat when GoToChat clicked in FaqView', async () => {
    const user = userEvent.setup();
    render(<SeniorPage />);

    await user.click(screen.getByText('GoToChat'));

    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });
});
