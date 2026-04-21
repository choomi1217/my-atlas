import { useCallback, useEffect, useState } from 'react';
import { testCaseApi } from '@/api/features';
import { TestCase, TestCaseStatus } from '@/types/features';

interface UseCompanyDraftTestCasesResult {
  testCases: TestCase[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches all DRAFT TCs across every Product in a Company.
 *
 * Used by the Company-level DRAFT dashboard on the Test Studio Home page.
 */
export function useCompanyDraftTestCases(
  companyId: number | null
): UseCompanyDraftTestCasesResult {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setTestCases([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await testCaseApi.getByCompanyId(companyId, TestCaseStatus.DRAFT);
      setTestCases(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DRAFT TCs');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  return { testCases, isLoading, error, refresh: load };
}
