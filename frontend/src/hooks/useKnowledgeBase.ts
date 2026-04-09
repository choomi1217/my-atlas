import { useState, useEffect, useCallback, useMemo } from 'react';
import { KbItem, KbRequest } from '@/types/senior';
import { kbApi } from '@/api/senior';

export type SourceFilter = 'all' | 'manual' | 'pdf';

export const useKnowledgeBase = () => {
  const [kbItems, setKbItems] = useState<KbItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const fetchKbItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await kbApi.getAll();
      setKbItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Knowledge Base');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKbItems();
  }, [fetchKbItems]);

  const filteredItems = useMemo(() => {
    switch (sourceFilter) {
      case 'manual':
        return kbItems.filter((item) => item.source === null);
      case 'pdf':
        return kbItems.filter((item) => item.source !== null);
      default:
        return kbItems;
    }
  }, [kbItems, sourceFilter]);

  const manualCount = useMemo(() => kbItems.filter((item) => item.source === null).length, [kbItems]);
  const pdfCount = useMemo(() => kbItems.filter((item) => item.source !== null).length, [kbItems]);

  const createKbItem = useCallback(async (request: KbRequest) => {
    const created = await kbApi.create(request);
    setKbItems((prev) => [...prev, created]);
    return created;
  }, []);

  const updateKbItem = useCallback(async (id: number, request: KbRequest) => {
    const updated = await kbApi.update(id, request);
    setKbItems((prev) => prev.map((k) => (k.id === id ? updated : k)));
    return updated;
  }, []);

  const deleteKbItem = useCallback(async (id: number) => {
    await kbApi.delete(id);
    setKbItems((prev) => prev.filter((k) => k.id !== id));
  }, []);

  const deleteBook = useCallback(async (source: string) => {
    await kbApi.deleteBook(source);
    setKbItems((prev) => prev.filter((k) => k.source !== source));
  }, []);

  const pinKbItem = useCallback(async (id: number) => {
    await kbApi.pin(id);
    setKbItems((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, pinnedAt: new Date().toISOString() } : k
      )
    );
  }, []);

  const unpinKbItem = useCallback(async (id: number) => {
    await kbApi.unpin(id);
    setKbItems((prev) =>
      prev.map((k) => (k.id === id ? { ...k, pinnedAt: null } : k))
    );
  }, []);

  return {
    kbItems,
    filteredItems,
    isLoading,
    error,
    sourceFilter,
    setSourceFilter,
    manualCount,
    pdfCount,
    fetchKbItems,
    createKbItem,
    updateKbItem,
    deleteKbItem,
    deleteBook,
    pinKbItem,
    unpinKbItem,
  };
};
