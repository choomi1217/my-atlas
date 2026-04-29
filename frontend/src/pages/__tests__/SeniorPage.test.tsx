import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SeniorPage from '../SeniorPage';
import { KbItem } from '@/types/senior';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const sampleFaqs: KbItem[] = [
  {
    id: 1,
    title: 'Hotfix 결정 기준',
    content: 'Content body',
    snippet: 'Snippet text',
    category: 'Hotfix 결정 기준',
    source: null,
    hitCount: 3,
    pinnedAt: '2026-04-01T00:00:00',
    createdAt: '2026-04-01T00:00:00',
    updatedAt: '2026-04-01T00:00:00',
    deletedAt: null,
  },
  {
    id: 2,
    title: '1.1.1 테스트 계획 활동',
    content: 'PDF chunk content',
    snippet: 'PDF snippet',
    category: null,
    source: 'ISTQB Foundation Level',
    hitCount: 0,
    pinnedAt: '2026-04-02T00:00:00',
    createdAt: '2026-04-02T00:00:00',
    updatedAt: '2026-04-02T00:00:00',
    deletedAt: null,
  },
];

vi.mock('@/hooks/useCuratedFaq', () => ({
  useCuratedFaq: () => ({
    faqs: sampleFaqs,
    isLoading: false,
    error: null,
  }),
}));

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/senior']}>
      <SeniorPage />
    </MemoryRouter>
  );
}

describe('SeniorPage (v7 — Chat-First Hybrid)', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it('renders Hero Section with headline and input', () => {
    renderWithRouter();
    expect(screen.getByText('무엇을 도와드릴까요?')).toBeInTheDocument();
    expect(screen.getByTestId('senior-hero-input')).toBeInTheDocument();
    expect(screen.getByTestId('senior-hero-submit')).toBeInTheDocument();
  });

  it('renders RecommendedChips with category/source labels', () => {
    renderWithRouter();
    const chips = screen.getByTestId('senior-recommended-chips');
    // Manual KB chip uses category as label
    expect(chips).toHaveTextContent('Hotfix 결정 기준');
    // PDF KB chip uses source as label
    expect(chips).toHaveTextContent('ISTQB Foundation Level');
  });

  it('renders FAQ Section with title and search', () => {
    renderWithRouter();
    expect(screen.getByText('자주 묻는 질문')).toBeInTheDocument();
    expect(screen.getByTestId('senior-faq-search')).toBeInTheDocument();
    expect(screen.getByTestId('senior-faq-show-all')).toBeInTheDocument();
  });

  it('Hero submit navigates to /senior/chat?q=...', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.type(screen.getByTestId('senior-hero-input'), '테스트 메시지');
    await user.click(screen.getByTestId('senior-hero-submit'));
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/senior\/chat\?q=/)
    );
  });

  it('Chip click navigates to /senior/chat with chip label as q', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByTestId('senior-chip-1'));
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/senior\/chat\?q=.+/)
    );
  });

  it('"전체보기" navigates to /senior/faq', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByTestId('senior-faq-show-all'));
    expect(navigateMock).toHaveBeenCalledWith('/senior/faq');
  });

  it('FAQ card click navigates within page (no router navigation)', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    const card = screen.getByTestId('faq-card-1');
    await user.click(card);
    // Inline expand — no navigate call from the card click itself
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
