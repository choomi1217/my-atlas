import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompanyListPage from '../CompanyListPage';

vi.mock('@/api/features', () => ({
  companyApi: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    activate: vi.fn(),
  },
}));

vi.mock('@/context/ActiveCompanyContext', () => ({
  useActiveCompany: () => ({
    activeCompany: null,
    setActiveCompany: vi.fn(),
    refreshActiveCompany: vi.fn(),
  }),
}));

vi.mock('@/components/features/CompanyFormModal', () => ({
  default: () => null,
}));

vi.mock('@/components/features/ConfirmDialog', () => ({
  default: () => null,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/features']}>
      <CompanyListPage />
    </MemoryRouter>
  );

describe('CompanyListPage 레이아웃 (PR-A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('자기 참조 Breadcrumb 를 더 이상 렌더하지 않는다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Companies')).toBeInTheDocument();
    });

    // Breadcrumb 컴포넌트의 nav 요소가 없어야 함
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    // "Product Test Suite" 자기 참조 링크가 없어야 함
    expect(screen.queryByText('Product Test Suite')).not.toBeInTheDocument();
  });

  it('컨테이너에 company-list-container testid 가 부여되어 있다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('company-list-container')).toBeInTheDocument();
    });
  });

  it('Companies 페이지 타이틀(h1)은 그대로 노출된다', async () => {
    renderPage();

    await waitFor(() => {
      const h1 = screen.getByRole('heading', { level: 1, name: 'Companies' });
      expect(h1).toBeInTheDocument();
    });
  });
});
