import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FaqCard from '../FaqCard';
import { KbItem } from '@/types/senior';

const mockItem: KbItem = {
  id: 1,
  title: 'Login Testing Guide',
  content: 'Step-by-step guide for login testing.',
  category: 'QA',
  tags: 'auth,login',
  source: null,
  hitCount: 5,
  pinnedAt: null,
  createdAt: '2026-03-26T10:00:00',
  updatedAt: '2026-03-26T10:00:00',
};

describe('FaqCard', () => {
  const defaultProps = {
    item: mockItem,
    onSendToChat: vi.fn(),
  };

  it('renders title', () => {
    render(<FaqCard {...defaultProps} />);
    expect(screen.getByText('Login Testing Guide')).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(<FaqCard {...defaultProps} />);
    expect(screen.getByText('#auth')).toBeInTheDocument();
    expect(screen.getByText('#login')).toBeInTheDocument();
  });

  it('does not show content initially (collapsed)', () => {
    render(<FaqCard {...defaultProps} />);
    expect(screen.queryByText('Step-by-step guide for login testing.')).not.toBeInTheDocument();
  });

  it('expands on click to show content', async () => {
    const user = userEvent.setup();
    render(<FaqCard {...defaultProps} />);

    await user.click(screen.getByText('Login Testing Guide'));

    expect(screen.getByText('Step-by-step guide for login testing.')).toBeInTheDocument();
  });

  it('shows Pinned badge when pinned', () => {
    const pinnedItem = { ...mockItem, pinnedAt: '2026-04-01T00:00:00' };
    render(<FaqCard item={pinnedItem} onSendToChat={vi.fn()} />);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('calls onSendToChat when chat button clicked', async () => {
    const user = userEvent.setup();
    const onSendToChat = vi.fn();
    render(<FaqCard item={mockItem} onSendToChat={onSendToChat} />);

    await user.click(screen.getByText('Login Testing Guide'));
    await user.click(screen.getByText(/Chat에서 더 물어보기/));

    expect(onSendToChat).toHaveBeenCalledWith(mockItem);
  });
});
