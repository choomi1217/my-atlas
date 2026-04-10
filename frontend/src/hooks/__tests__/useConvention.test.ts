import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConvention } from '../useConvention';

// Mock conventionApi
vi.mock('@/api/convention', () => ({
  conventionApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { conventionApi } from '@/api/convention';

const mockConventions = [
  {
    id: 1,
    term: 'TC',
    definition: 'Test Case',
    category: 'Testing',
    imageUrl: '/api/convention-images/tc.png',
    createdAt: '2026-04-01T10:00:00',
    updatedAt: '2026-04-01T10:00:00',
  },
  {
    id: 2,
    term: 'QA',
    definition: 'Quality Assurance',
    category: 'General',
    imageUrl: null,
    createdAt: '2026-04-02T10:00:00',
    updatedAt: null,
  },
  {
    id: 3,
    term: 'BDD',
    definition: 'Behavior Driven Development',
    category: 'Methodology',
    imageUrl: null,
    createdAt: '2026-03-30T10:00:00',
    updatedAt: null,
  },
];

describe('useConvention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(conventionApi.getAll).mockResolvedValue([...mockConventions]);
  });

  // --- Initial fetch ---

  it('fetches conventions on mount', async () => {
    const { result } = renderHook(() => useConvention());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.conventions).toHaveLength(3);
    expect(conventionApi.getAll).toHaveBeenCalledTimes(1);
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(conventionApi.getAll).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.conventions).toHaveLength(0);
  });

  // --- Search filtering ---

  it('filters by search query matching term', async () => {
    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearchQuery('TC');
    });

    expect(result.current.filteredAndSorted).toHaveLength(1);
    expect(result.current.filteredAndSorted[0].term).toBe('TC');
  });

  it('filters by search query matching definition', async () => {
    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearchQuery('Quality');
    });

    expect(result.current.filteredAndSorted).toHaveLength(1);
    expect(result.current.filteredAndSorted[0].term).toBe('QA');
  });

  it('filters by search query matching category', async () => {
    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearchQuery('Methodology');
    });

    expect(result.current.filteredAndSorted).toHaveLength(1);
    expect(result.current.filteredAndSorted[0].term).toBe('BDD');
  });

  it('search is case insensitive', async () => {
    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearchQuery('quality');
    });

    expect(result.current.filteredAndSorted).toHaveLength(1);
    expect(result.current.filteredAndSorted[0].term).toBe('QA');
  });

  it('returns all when search query is empty', async () => {
    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearchQuery('');
    });

    expect(result.current.filteredAndSorted).toHaveLength(3);
  });

  // --- Sort ---

  it('sorts by date (default, newest first)', async () => {
    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sortBy).toBe('date');
    // QA (2026-04-02) > TC (2026-04-01) > BDD (2026-03-30)
    expect(result.current.filteredAndSorted[0].term).toBe('QA');
    expect(result.current.filteredAndSorted[1].term).toBe('TC');
    expect(result.current.filteredAndSorted[2].term).toBe('BDD');
  });

  it('sorts by name alphabetically', async () => {
    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSortBy('name');
    });

    // BDD < QA < TC
    expect(result.current.filteredAndSorted[0].term).toBe('BDD');
    expect(result.current.filteredAndSorted[1].term).toBe('QA');
    expect(result.current.filteredAndSorted[2].term).toBe('TC');
  });

  // --- Create ---

  it('creates a convention and adds it to list', async () => {
    const newConvention = {
      id: 4,
      term: 'E2E',
      definition: 'End to End',
      category: 'Testing',
      imageUrl: null,
      createdAt: '2026-04-03T10:00:00',
      updatedAt: null,
    };
    vi.mocked(conventionApi.create).mockResolvedValue(newConvention);

    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.create({ term: 'E2E', definition: 'End to End', category: 'Testing' });
    });

    expect(conventionApi.create).toHaveBeenCalledWith({
      term: 'E2E',
      definition: 'End to End',
      category: 'Testing',
    });
    expect(result.current.conventions).toHaveLength(4);
    expect(result.current.conventions[3].term).toBe('E2E');
  });

  // --- Delete ---

  it('deletes a convention and removes it from list', async () => {
    vi.mocked(conventionApi.delete).mockResolvedValue(undefined);

    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.conventions).toHaveLength(3);

    await act(async () => {
      await result.current.deleteConvention(1);
    });

    expect(conventionApi.delete).toHaveBeenCalledWith(1);
    expect(result.current.conventions).toHaveLength(2);
    expect(result.current.conventions.find((c) => c.id === 1)).toBeUndefined();
  });

  // --- Update ---

  it('updates a convention in the list', async () => {
    const updatedConvention = {
      id: 1,
      term: 'TC Updated',
      definition: 'Test Case Updated',
      category: 'Testing',
      imageUrl: '/api/convention-images/updated.png',
      createdAt: '2026-04-01T10:00:00',
      updatedAt: '2026-04-05T10:00:00',
    };
    vi.mocked(conventionApi.update).mockResolvedValue(updatedConvention);

    const { result } = renderHook(() => useConvention());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.update(1, {
        term: 'TC Updated',
        definition: 'Test Case Updated',
        category: 'Testing',
        imageUrl: '/api/convention-images/updated.png',
      });
    });

    expect(conventionApi.update).toHaveBeenCalledWith(1, {
      term: 'TC Updated',
      definition: 'Test Case Updated',
      category: 'Testing',
      imageUrl: '/api/convention-images/updated.png',
    });
    const found = result.current.conventions.find((c) => c.id === 1);
    expect(found?.term).toBe('TC Updated');
  });
});
