import { useCallback, useEffect, useRef, useState } from 'react';
import { testStudioApi } from '@/api/test-studio';
import { TestStudioJob } from '@/types/test-studio';

interface UseTestStudioResult {
  jobs: TestStudioJob[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  createJob: (form: FormData) => Promise<number>;
  deleteJob: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Test Studio hook — fetches and polls jobs for a product.
 * Polls every 2s while any job is PENDING or PROCESSING; stops otherwise.
 */
export function useTestStudio(productId: number | undefined): UseTestStudioResult {
  const [jobs, setJobs] = useState<TestStudioJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    if (!productId) return;
    try {
      const list = await testStudioApi.listJobs(productId);
      setJobs(list);
      const hasActive = list.some(
        (j) => j.status === 'PENDING' || j.status === 'PROCESSING'
      );
      if (!hasActive) {
        stopPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      stopPolling();
    }
  }, [productId, stopPolling]);

  const startPollingIfNeeded = useCallback(
    (list: TestStudioJob[]) => {
      const hasActive = list.some(
        (j) => j.status === 'PENDING' || j.status === 'PROCESSING'
      );
      if (hasActive && !intervalRef.current) {
        intervalRef.current = setInterval(() => {
          fetchJobs();
        }, POLL_INTERVAL_MS);
      }
    },
    [fetchJobs]
  );

  // Initial load + subsequent re-starts when productId changes
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await testStudioApi.listJobs(productId);
        if (!cancelled) {
          setJobs(list);
          startPollingIfNeeded(list);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [productId, startPollingIfNeeded, stopPolling]);

  const createJob = useCallback(
    async (form: FormData): Promise<number> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { jobId } = await testStudioApi.createJob(form);
        // Optimistic refresh to show the new PENDING row immediately
        if (productId) {
          const list = await testStudioApi.listJobs(productId);
          setJobs(list);
          startPollingIfNeeded(list);
        }
        return jobId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create job';
        setError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [productId, startPollingIfNeeded]
  );

  const deleteJob = useCallback(
    async (id: number) => {
      await testStudioApi.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    },
    []
  );

  const refresh = useCallback(async () => {
    await fetchJobs();
  }, [fetchJobs]);

  return { jobs, isLoading, isSubmitting, error, createJob, deleteJob, refresh };
}
