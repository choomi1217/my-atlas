import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ConventionCard from '../ConventionCard';
import { ConventionItem } from '@/types/convention';

const mockConvention: ConventionItem = {
  id: 1,
  term: 'TC',
  definition: 'Test Case - A set of conditions to validate software behavior.',
  category: 'Testing',
  imageUrl: '/api/convention-images/tc.png',
  createdAt: '2026-04-01T10:00:00',
  updatedAt: '2026-04-01T10:00:00',
};

const mockConventionNoImage: ConventionItem = {
  id: 2,
  term: 'QA',
  definition: 'Quality Assurance',
  category: 'General',
  imageUrl: null,
  createdAt: '2026-04-01T10:00:00',
  updatedAt: null,
};

describe('ConventionCard', () => {
  const defaultProps = {
    convention: mockConvention,
    onClick: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders term', () => {
    render(<ConventionCard {...defaultProps} />);
    expect(screen.getByText('TC')).toBeInTheDocument();
  });

  it('renders definition', () => {
    render(<ConventionCard {...defaultProps} />);
    expect(
      screen.getByText('Test Case - A set of conditions to validate software behavior.')
    ).toBeInTheDocument();
  });

  it('renders category badge', () => {
    render(<ConventionCard {...defaultProps} />);
    expect(screen.getByText('Testing')).toBeInTheDocument();
  });

  it('renders image when imageUrl provided', () => {
    render(<ConventionCard {...defaultProps} />);
    const img = screen.getByAltText('TC');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/api/convention-images/tc.png');
  });

  it('renders placeholder SVG when no image', () => {
    render(
      <ConventionCard
        convention={mockConventionNoImage}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    // No img element should be present
    expect(screen.queryByAltText('QA')).not.toBeInTheDocument();
    // SVG placeholder and "No Image" text should be present
    expect(screen.getByText('No Image')).toBeInTheDocument();
    const svgElements = document.querySelectorAll('svg');
    // There should be at least the placeholder SVG (plus the delete button SVG)
    expect(svgElements.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onClick when card clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ConventionCard convention={mockConvention} onClick={onClick} onDelete={vi.fn()} />);

    await user.click(screen.getByText('TC'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when delete button clicked with stopPropagation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onDelete = vi.fn();
    render(<ConventionCard convention={mockConvention} onClick={onClick} onDelete={onDelete} />);

    // The delete button has title="삭제"
    const deleteButton = screen.getByTitle('삭제');
    await user.click(deleteButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    // onClick should NOT be called because stopPropagation is called in handleDelete
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not render category badge when category is null', () => {
    const noCategoryConvention: ConventionItem = {
      ...mockConvention,
      category: null,
    };
    render(
      <ConventionCard
        convention={noCategoryConvention}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    // "Testing" category badge should not be present
    expect(screen.queryByText('Testing')).not.toBeInTheDocument();
  });

  it('applies line-clamp-2 class on definition for truncation', () => {
    render(<ConventionCard {...defaultProps} />);
    const definition = screen.getByText(
      'Test Case - A set of conditions to validate software behavior.'
    );
    expect(definition.className).toContain('line-clamp-2');
  });
});
