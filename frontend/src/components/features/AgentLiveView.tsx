import { useEffect, useRef, useState } from 'react';
import { agentExecutionApi } from '@/api/features';

interface AgentLiveViewProps {
  jobId: number;
  active: boolean;
}

const FRAME_POLL_INTERVAL_MS = 1000;

/**
 * AI 실행 화면 라이브 뷰. 워커가 ~1초마다 올리는 최신 프레임을 폴링해 보여준다.
 * 인증 헤더가 필요해 <img src=URL>을 쓸 수 없으므로 Blob → object URL로 표시한다.
 */
export default function AgentLiveView({ jobId, active }: AgentLiveViewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const blob = await agentExecutionApi.getFrame(jobId);
        if (cancelled || !blob) return;
        const next = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = next;
        setUrl(next);
      } catch {
        // 폴링 오류는 무시 — 마지막 프레임 유지
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
    };
  }, [jobId, active]);

  if (!active) return null;

  return (
    <div className="mb-4">
      <div className="text-xs text-gray-500 mb-1">실행 화면</div>
      {url ? (
        <img
          alt="AI 실행 화면"
          data-testid="agent-live-frame"
          className="mx-auto max-h-[50vh] rounded border"
          src={url}
        />
      ) : (
        <div
          data-testid="agent-live-waiting"
          className="text-sm text-gray-400 text-center py-6 border border-dashed rounded"
        >
          화면 수신 대기 중…
        </div>
      )}
    </div>
  );
}
