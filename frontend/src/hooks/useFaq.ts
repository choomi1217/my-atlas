import { useState, useEffect, useCallback } from 'react';
import { FaqItem, FaqRequest } from '@/types/senior';
import { faqApi } from '@/api/senior';

export const useFaq = () => {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
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

  const createFaq = useCallback(async (request: FaqRequest) => {
    const created = await faqApi.create(request);
    setFaqs((prev) => [...prev, created]);
    return created;
  }, []);

  const updateFaq = useCallback(async (id: number, request: FaqRequest) => {
    const updated = await faqApi.update(id, request);
    setFaqs((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const deleteFaq = useCallback(async (id: number) => {
    await faqApi.delete(id);
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { faqs, isLoading, error, fetchFaqs, createFaq, updateFaq, deleteFaq };
};
