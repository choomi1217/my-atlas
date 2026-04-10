import { useState, useEffect, useCallback, useMemo } from 'react';
import { ConventionItem, ConventionRequest } from '@/types/convention';
import { conventionApi } from '@/api/convention';

export type SortBy = 'name' | 'date';

export const useConvention = () => {
  const [conventions, setConventions] = useState<ConventionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await conventionApi.getAll();
      setConventions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conventions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredAndSorted = useMemo(() => {
    let result = conventions;

    // Filter by search query (term + definition + category)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.term.toLowerCase().includes(query) ||
          item.definition.toLowerCase().includes(query) ||
          (item.category && item.category.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...result];
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.term.localeCompare(b.term));
    } else {
      // date: createdAt DESC (newest first)
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return sorted;
  }, [conventions, searchQuery, sortBy]);

  const create = useCallback(async (request: ConventionRequest) => {
    const created = await conventionApi.create(request);
    setConventions((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id: number, request: ConventionRequest) => {
    const updated = await conventionApi.update(id, request);
    setConventions((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const deleteConvention = useCallback(async (id: number) => {
    await conventionApi.delete(id);
    setConventions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    conventions,
    filteredAndSorted,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    fetchAll,
    create,
    update,
    deleteConvention,
  };
};
