import { useEffect, useRef, useState } from 'react';
import { agentExecutionApi } from '@/api/features';

interface AgentStepScreenshotProps {
  jobId: number;
  testCaseId: number;
  stepOrder: number;
  /** Job이 아직 대기·실행 중인지 */
  active: boolean;
  /** Step에 판정이 나왔는지 */
  settled: boolean;
}

const RETRY_INTERVAL_MS = 3000;

/**
 * Step 스크린샷 썸네일. 인증 헤더가 필요해 <img src=URL>을 쓸 수 없으므로 Blob → object URL로 표시한다.
 * 이미지가 없으면 아무것도 그리지 않는다. 판정 전에 못 찾았을 때만 다시 가져오고, 판정 뒤에는 1회만 확인한다.
 */
export default function AgentStepScreenshot({
  jobId,
  testCaseId,
  stepOrder,
  active,
  settled,
}: AgentStepScreenshotProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (urlRef.current && settled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async (): Promise<boolean> => {
      try {
        const blob = await agentExecutionApi.getScreenshot(jobId, testCaseId, stepOrder);
        if (cancelled || !blob) return false;
        const next = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = next;
        setUrl(next);
        return true;
      } catch {
        // 조회 실패는 무시 — 스크린샷은 부가 증적이다
        return false;
      }
    };

    void load().then((found) => {
      // 판정이 나온 Step은 업로드가 끝난 뒤다 — 이때도 없으면 앞으로도 없다 (건너뛴 Step 등)
      if (found || cancelled || !active || settled) return;
      timer = setInterval(async () => {
        if (await load() && timer) clearInterval(timer);
      }, RETRY_INTERVAL_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [jobId, testCaseId, stepOrder, active, settled]);

  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!zoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [zoomed]);

  if (!url) return null;

  return (
    <>
      <button
        type="button"
        aria-label="스크린샷 확대"
        data-testid="automation-step-screenshot"
        onClick={() => setZoomed(true)}
        className="block cursor-zoom-in"
      >
        <img
          alt={`Step ${stepOrder} 스크린샷`}
          className="max-h-40 rounded border"
          src={url}
        />
      </button>
      {zoomed && (
        <div
          data-testid="automation-step-screenshot-zoom"
          role="dialog"
          aria-label="스크린샷 확대 보기"
          onClick={() => setZoomed(false)}
          className="fixed inset-0 bg-black/85 z-[70] flex flex-col items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            alt={`Step ${stepOrder} 스크린샷 확대`}
            className="min-h-0 flex-1 max-w-full object-contain rounded shadow-2xl"
            src={url}
          />
          <div className="mt-3 text-xs text-white/60">클릭 또는 Esc로 닫기</div>
        </div>
      )}
    </>
  );
}
