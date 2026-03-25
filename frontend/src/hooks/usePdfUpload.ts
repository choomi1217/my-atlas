import { useState, useCallback, useRef } from 'react';
import { PdfUploadJob } from '@/types/senior';
import { kbApi } from '@/api/senior';

interface UsePdfUploadOptions {
  onComplete?: (job: PdfUploadJob) => void;
  onError?: (job: PdfUploadJob) => void;
}

export const usePdfUpload = ({ onComplete, onError }: UsePdfUploadOptions = {}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [currentJob, setCurrentJob] = useState<PdfUploadJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const uploadPdf = useCallback(async (file: File, bookTitle: string) => {
    setIsUploading(true);
    setError(null);
    setCurrentJob(null);
    stopPolling();

    try {
      const { jobId } = await kbApi.uploadPdf(file, bookTitle);

      // Start polling
      intervalRef.current = setInterval(async () => {
        try {
          const job = await kbApi.getJob(jobId);
          setCurrentJob(job);

          if (job.status === 'DONE') {
            stopPolling();
            setIsUploading(false);
            onComplete?.(job);
          } else if (job.status === 'FAILED') {
            stopPolling();
            setIsUploading(false);
            setError(job.errorMessage || 'Upload failed');
            onError?.(job);
          }
        } catch (err) {
          stopPolling();
          setIsUploading(false);
          setError(err instanceof Error ? err.message : 'Failed to check job status');
        }
      }, 3000);
    } catch (err) {
      setIsUploading(false);
      setError(err instanceof Error ? err.message : 'Failed to start upload');
    }
  }, [onComplete, onError, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setIsUploading(false);
    setCurrentJob(null);
    setError(null);
  }, [stopPolling]);

  return { isUploading, currentJob, error, uploadPdf, reset };
};
