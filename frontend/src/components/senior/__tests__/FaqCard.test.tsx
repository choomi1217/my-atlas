import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FaqCard from '../FaqCard';
import { KbItem } from '@/types/senior';

const mockItem: KbItem = {
  id: 1,
  title: 'Login Testing Guide',
  content: 'Step-by-step guide for login testing.',
  snippet: 'Step-by-step guide for login testing.',
  category: 'QA',
  source: null,
  hitCount: 5,
  pinnedAt: null,
  createdAt: '2026-03-26T10:00:00',
  updatedAt: '2026-03-26T10:00:00',
  deletedAt: null,
};

describe('FaqCard (v7)', () => {
  const defaultProps = {
    item: mockItem,
    onSendToChat: vi.fn(),
  };

  it('renders title and category badge', () => {
    render(<FaqCard {...defaultProps} />);
    expect(screen.getByText('Login Testing Guide')).toBeInTheDocument();
    expect(screen.getByText('QA')).toBeInTheDocument();
  });

  it('shows snippet (1~2 lines) when collapsed', () => {
    render(<FaqCard {...defaultProps} />);
    expect(screen.getByTestId('faq-snippet-1')).toBeInTheDocument();
    expect(screen.getByTestId('faq-snippet-1')).toHaveTextContent(
      'Step-by-step guide for login testing.'
    );
  });

  it('does not render expanded content area when collapsed', () => {
    render(<FaqCard {...defaultProps} />);
    expect(screen.queryByTestId('faq-content-1')).not.toBeInTheDocument();
  });

  it('expands inline on card click and shows full content', async () => {
    const user = userEvent.setup();
    render(<FaqCard {...defaultProps} />);
    await user.click(screen.getByTestId('faq-card-1'));
    expect(screen.getByTestId('faq-content-1')).toBeInTheDocument();
    // Snippet hidden after expand
    expect(screen.queryByTestId('faq-snippet-1')).not.toBeInTheDocument();
  });

  it('shows PDF badge for KB entries with source', () => {
    const pdfItem = { ...mockItem, source: 'ISTQB Foundation' };
    render(<FaqCard item={pdfItem} onSendToChat={vi.fn()} />);
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('does not show "Pinned" badge in v7 (pin indicator moved to /kb page)', () => {
    const pinnedItem = { ...mockItem, pinnedAt: '2026-04-01T00:00:00' };
    render(<FaqCard item={pinnedItem} onSendToChat={vi.fn()} />);
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument();
  });

  it('calls onSendToChat when "Chat에서 더 물어보기" clicked after expand', async () => {
    const user = userEvent.setup();
    const onSendToChat = vi.fn();
    render(<FaqCard item={mockItem} onSendToChat={onSendToChat} />);

    await user.click(screen.getByTestId('faq-card-1'));
    await user.click(screen.getByTestId('faq-send-to-chat-1'));

    expect(onSendToChat).toHaveBeenCalledWith(mockItem);
  });
});
