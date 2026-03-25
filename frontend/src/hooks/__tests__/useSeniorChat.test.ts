import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSeniorChat } from '../useSeniorChat';

// Mock chatApi
vi.mock('@/api/senior', () => ({
  chatApi: {
    streamChat: vi.fn(),
  },
}));

import { chatApi } from '@/api/senior';

describe('useSeniorChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useSeniorChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.faqContext).toBeNull();
  });

  it('sendMessage adds user and assistant messages and sets streaming', () => {
    const mockController = { abort: vi.fn() } as unknown as AbortController;
    vi.mocked(chatApi.streamChat).mockReturnValue(mockController);

    const { result } = renderHook(() => useSeniorChat());

    act(() => {
      result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Hello');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('');
    expect(result.current.isStreaming).toBe(true);
  });

  it('does not send empty messages', () => {
    const { result } = renderHook(() => useSeniorChat());

    act(() => {
      result.current.sendMessage('');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(chatApi.streamChat).not.toHaveBeenCalled();
  });

  it('does not send while streaming', () => {
    const mockController = { abort: vi.fn() } as unknown as AbortController;
    vi.mocked(chatApi.streamChat).mockReturnValue(mockController);

    const { result } = renderHook(() => useSeniorChat());

    act(() => {
      result.current.sendMessage('First');
    });

    act(() => {
      result.current.sendMessage('Second');
    });

    // Only first message should have been sent
    expect(chatApi.streamChat).toHaveBeenCalledTimes(1);
  });

  it('onChunk appends to assistant message', () => {
    let capturedOnChunk: ((text: string) => void) | undefined;

    vi.mocked(chatApi.streamChat).mockImplementation(
      (_msg, onChunk, _onDone, _onError, _ctx) => {
        capturedOnChunk = onChunk;
        return { abort: vi.fn() } as unknown as AbortController;
      }
    );

    const { result } = renderHook(() => useSeniorChat());

    act(() => {
      result.current.sendMessage('Hello');
    });

    act(() => {
      capturedOnChunk!('Hi ');
    });

    act(() => {
      capturedOnChunk!('there!');
    });

    expect(result.current.messages[1].content).toBe('Hi there!');
  });

  it('onDone sets streaming false', () => {
    let capturedOnDone: (() => void) | undefined;

    vi.mocked(chatApi.streamChat).mockImplementation(
      (_msg, _onChunk, onDone, _onError, _ctx) => {
        capturedOnDone = onDone;
        return { abort: vi.fn() } as unknown as AbortController;
      }
    );

    const { result } = renderHook(() => useSeniorChat());

    act(() => {
      result.current.sendMessage('Hello');
    });

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      capturedOnDone!();
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it('onError sets error state', () => {
    let capturedOnError: ((err: Error) => void) | undefined;

    vi.mocked(chatApi.streamChat).mockImplementation(
      (_msg, _onChunk, _onDone, onError, _ctx) => {
        capturedOnError = onError;
        return { abort: vi.fn() } as unknown as AbortController;
      }
    );

    const { result } = renderHook(() => useSeniorChat());

    act(() => {
      result.current.sendMessage('Hello');
    });

    act(() => {
      capturedOnError!(new Error('Network failure'));
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('Network failure');
  });

  it('stopStreaming aborts and sets streaming false', () => {
    const mockAbort = vi.fn();
    vi.mocked(chatApi.streamChat).mockReturnValue({ abort: mockAbort } as unknown as AbortController);

    const { result } = renderHook(() => useSeniorChat());

    act(() => {
      result.current.sendMessage('Hello');
    });

    act(() => {
      result.current.stopStreaming();
    });

    expect(mockAbort).toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
  });

  it('clearChat resets all state', () => {
    const mockController = { abort: vi.fn() } as unknown as AbortController;
    vi.mocked(chatApi.streamChat).mockReturnValue(mockController);

    const { result } = renderHook(() => useSeniorChat());

    act(() => {
      result.current.sendMessage('Hello');
    });

    act(() => {
      result.current.clearChat();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.faqContext).toBeNull();
  });

  it('sendMessage with faqContext includes it in API call', () => {
    const mockController = { abort: vi.fn() } as unknown as AbortController;
    vi.mocked(chatApi.streamChat).mockReturnValue(mockController);

    const { result } = renderHook(() => useSeniorChat());

    const faq = { id: 1, title: 'Login FAQ', content: 'How to test login', tags: null, createdAt: '', updatedAt: '' };

    act(() => {
      result.current.setFaqContext(faq);
    });

    act(() => {
      result.current.sendMessage('Tell me more');
    });

    expect(chatApi.streamChat).toHaveBeenCalledWith(
      'Tell me more',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      { title: 'Login FAQ', content: 'How to test login' }
    );

    // faqContext should be cleared after sending
    expect(result.current.faqContext).toBeNull();
  });
});
