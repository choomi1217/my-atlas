import { useCallback, useEffect, useRef, useState } from 'react';
import { testStudioApi } from '@/api/test-studio';
import { TestStudioJob } from '@/types/test-studio';

interface UseCompanyTestStudioJobsResult {
  jobs: TestStudioJob[];
  isLoading: boolean;
  error: string | null;
  deleteJob: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Company-level Test Studio job hook.
 *
 * Fetches all jobs across every Product in a Company and polls every 2 seconds while any
 * job is PENDING/PROCESSING. Stops polling when all jobs reach a terminal state.
 */
export function useCompanyTestStudioJobs(
  companyId: number | null
): UseCompanyTestStudioJobsResult {
  const [jobs, setJobs] = useState<TestStudioJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    if (!companyId) return;
    try {
      const list = await testStudioApi.listJobsByCompany(companyId);
      setJobs(list);
      const hasActive = list.some(
        (j) => j.status === 'PENDING' || j.status === 'PROCESSING'
      );
      if (!hasActive) stopPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      stopPolling();
    }
  }, [companyId, stopPolling]);

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

  useEffect(() => {
    if (!companyId) {
      setJobs([]);
      stopPolling();
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await testStudioApi.listJobsByCompany(companyId);
        if (!cancelled) {
          setJobs(list);
          startPollingIfNeeded(list);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [companyId, startPollingIfNeeded, stopPolling]);

  const deleteJob = useCallback(async (id: number) => {
    await testStudioApi.deleteJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  return { jobs, isLoading, error, deleteJob, refresh: fetchJobs };
}
