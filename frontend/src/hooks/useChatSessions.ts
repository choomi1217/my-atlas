import { useState, useCallback, useEffect } from 'react';
import { ChatSession } from '@/types/senior';
import { sessionApi } from '@/api/senior';

export const useChatSessions = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await sessionApi.getAll();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const deleteSession = useCallback(async (id: number) => {
    try {
      await sessionApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  }, []);

  const renameSession = useCallback(async (id: number, title: string) => {
    try {
      const updated = await sessionApi.updateTitle(id, title);
      setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename session');
    }
  }, []);

  return {
    sessions,
    isLoading,
    error,
    fetchSessions,
    deleteSession,
    renameSession,
  };
};
