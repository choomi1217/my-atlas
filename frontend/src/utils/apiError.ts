import axios from 'axios';

/**
 * API 오류에서 사용자에게 보여줄 메시지를 꺼낸다.
 * 서버가 ApiResponse({ message })로 내려준 본문(예: 409 충돌 사유)을 우선한다.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data;
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = (data as { message: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }
  }
  return err instanceof Error && err.message ? err.message : fallback;
}
