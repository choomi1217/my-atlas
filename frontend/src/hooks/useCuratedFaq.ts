import { useState, useEffect, useCallback } from 'react';
import { KbItem } from '@/types/senior';
import { faqApi } from '@/api/senior';

export const useCuratedFaq = () => {
  const [faqs, setFaqs] = useState<KbItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFaqs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await faqApi.getAll();
      setFaqs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FAQs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  return { faqs, isLoading, error, fetchFaqs };
};
