import { useState, useEffect, useCallback } from 'react';
import { KbItem, KbRequest } from '@/types/senior';
import { kbApi } from '@/api/senior';

export const useKnowledgeBase = () => {
  const [kbItems, setKbItems] = useState<KbItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return { kbItems, isLoading, error, fetchKbItems, createKbItem, updateKbItem, deleteKbItem };
};
