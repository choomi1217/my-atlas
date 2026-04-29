import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ChatView from '../ChatView';
import { ChatMessage } from '@/types/senior';

describe('ChatView', () => {
  const defaultProps = {
    messages: [] as ChatMessage[],
    isStreaming: false,
    error: null,
    faqContext: null,
    onSendMessage: vi.fn(),
    onClearChat: vi.fn(),
  };

  it('shows placeholder when no messages', () => {
    render(<ChatView {...defaultProps} />);
    expect(screen.getByText('Ask your Senior QA any question...')).toBeInTheDocument();
  });

  it('renders user and assistant messages', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'How to test login?', timestamp: new Date() },
      { id: '2', role: 'assistant', content: 'Here are the steps...', timestamp: new Date() },
    ];

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(screen.getByText('How to test login?')).toBeInTheDocument();
    expect(screen.getByText('Here are the steps...')).toBeInTheDocument();
  });

  it('sends message on button click', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    render(<ChatView {...defaultProps} onSendMessage={onSendMessage} />);

    const input = screen.getByPlaceholderText('Type your question...');
    await user.type(input, 'Hello');
    await user.click(screen.getByText('Send'));

    expect(onSendMessage).toHaveBeenCalledWith('Hello');
  });

  it('sends message on Enter key', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    render(<ChatView {...defaultProps} onSendMessage={onSendMessage} />);

    const input = screen.getByPlaceholderText('Type your question...');
    await user.type(input, 'Hello{Enter}');

    expect(onSendMessage).toHaveBeenCalledWith('Hello');
  });

  it('disables send button while streaming', () => {
    render(<ChatView {...defaultProps} isStreaming={true} />);

    expect(screen.getByText('Sending...')).toBeDisabled();
  });

  it('shows error message', () => {
    render(<ChatView {...defaultProps} error="Connection failed" />);

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows FAQ context banner', () => {
    const faqContext = { id: 1, title: 'Login FAQ', content: 'Content', snippet: 'Content', category: null, source: null, hitCount: 0, pinnedAt: null, createdAt: '2026-03-26', updatedAt: '2026-03-26', deletedAt: null };

    render(<ChatView {...defaultProps} faqContext={faqContext} />);

    expect(screen.getByText(/FAQ 참고:/)).toBeInTheDocument();
  });

  it('shows Clear button when messages exist', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
    ];

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('calls onClearChat when Clear clicked', async () => {
    const user = userEvent.setup();
    const onClearChat = vi.fn();
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
    ];

    render(<ChatView {...defaultProps} messages={messages} onClearChat={onClearChat} />);

    await user.click(screen.getByText('Clear'));

    expect(onClearChat).toHaveBeenCalled();
  });
});
