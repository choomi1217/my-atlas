import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FaqCard from '../FaqCard';
import { FaqItem } from '@/types/senior';

const mockFaq: FaqItem = {
  id: 1,
  title: 'Login Testing Guide',
  content: 'Step-by-step guide for login testing.',
  tags: 'auth,login',
  createdAt: '2026-03-26T10:00:00',
  updatedAt: '2026-03-26T10:00:00',
};

describe('FaqCard', () => {
  const defaultProps = {
    faq: mockFaq,
    onSendToChat: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
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

  it('shows Edit and Delete buttons when expanded', async () => {
    const user = userEvent.setup();
    render(<FaqCard {...defaultProps} />);

    await user.click(screen.getByText('Login Testing Guide'));

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onEdit when Edit clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<FaqCard {...defaultProps} onEdit={onEdit} />);

    await user.click(screen.getByText('Login Testing Guide'));
    await user.click(screen.getByText('Edit'));

    expect(onEdit).toHaveBeenCalledWith(mockFaq);
  });

  it('calls onDelete when Delete clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<FaqCard {...defaultProps} onDelete={onDelete} />);

    await user.click(screen.getByText('Login Testing Guide'));
    await user.click(screen.getByText('Delete'));

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('calls onSendToChat when chat button clicked', async () => {
    const user = userEvent.setup();
    const onSendToChat = vi.fn();
    render(<FaqCard {...defaultProps} onSendToChat={onSendToChat} />);

    await user.click(screen.getByText('Login Testing Guide'));
    await user.click(screen.getByText(/Chat에서 더 물어보기/));

    expect(onSendToChat).toHaveBeenCalledWith(mockFaq);
  });
});
