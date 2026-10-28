import { useEffect, useRef, useState } from 'react';
import { agentExecutionApi } from '@/api/features';
import type { AgentLiveProgress } from '@/types/features';
import AgentLiveFlow from './AgentLiveFlow';

interface AgentLiveViewProps {
  jobId: number;
  active: boolean;
}

const FRAME_POLL_INTERVAL_MS = 1000;

/**
 * AI 실행 화면 라이브 뷰. 워커가 ~1초마다 올리는 최신 프레임과 진행 상황을 폴링해 보여준다.
 * 인증 헤더가 필요해 <img src=URL>을 쓸 수 없으므로 Blob → object URL로 표시한다.
 */
export default function AgentLiveView({ jobId, active }: AgentLiveViewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<AgentLiveProgress | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [frameResult, progressResult] = await Promise.allSettled([
          agentExecutionApi.getFrame(jobId),
          agentExecutionApi.getProgress(jobId),
        ]);
        if (cancelled) return;
        // 폴링 오류(rejected)는 무시 — 마지막 값 유지
        if (progressResult.status === 'fulfilled') {
          setProgress(progressResult.value);
        }
        if (frameResult.status === 'fulfilled' && frameResult.value) {
          const next = URL.createObjectURL(frameResult.value);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = next;
          setUrl(next);
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(tick, FRAME_POLL_INTERVAL_MS);
    void tick();

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setUrl(null);
      setProgress(null);
      setZoomed(false);
    };
  }, [jobId, active]);

  useEffect(() => {
    if (!zoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [zoomed]);

  if (!active) return null;

  return (
    <div className="mb-4">
      <div className="text-xs text-gray-500 mb-1">실행 화면</div>
      {progress && <AgentLiveFlow progress={progress} />}
      {url ? (
        <button
          type="button"
          aria-label="실행 화면 확대"
          data-testid="agent-live-zoom-open"
          onClick={() => setZoomed(true)}
          className="block mx-auto cursor-zoom-in"
        >
          <img
            alt="AI 실행 화면"
            data-testid="agent-live-frame"
            className="max-h-[50vh] rounded border"
            src={url}
          />
        </button>
      ) : (
        <div
          data-testid="agent-live-waiting"
          className="text-sm text-gray-400 text-center py-6 border border-dashed rounded"
        >
          화면 수신 대기 중…
        </div>
      )}
      {zoomed && url && (
        <div
          data-testid="agent-live-zoom"
          role="dialog"
          aria-label="실행 화면 확대 보기"
          onClick={() => setZoomed(false)}
          className="fixed inset-0 bg-black/85 z-[70] flex flex-col items-center justify-center p-4 cursor-zoom-out"
        >
          {progress && (
            <div className="w-full max-w-xl">
              <AgentLiveFlow progress={progress} variant="dark" />
            </div>
          )}
          <img
            alt="AI 실행 화면 확대"
            className="min-h-0 flex-1 max-w-full object-contain rounded shadow-2xl"
            src={url}
          />
          <div className="mt-3 text-xs text-white/60">클릭 또는 Esc로 닫기</div>
        </div>
      )}
    </div>
  );
}
