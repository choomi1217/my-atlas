import { useState, KeyboardEvent } from 'react';

interface HeroSectionProps {
  onSubmit: (message: string) => void;
}

export default function HeroSection({ onSubmit }: HeroSectionProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section
      data-testid="senior-hero"
      className="rounded-2xl border border-gray-200 bg-white px-6 py-10 sm:px-10 sm:py-12"
    >
      <div className="text-center">
        <h1 className="text-[22px] font-medium text-gray-900">
          무엇을 도와드릴까요?
        </h1>
        <p className="mt-2 text-[13px] text-gray-500">
          QA 시니어에게 질문하거나, 아래 자주 묻는 질문에서 찾아보세요
        </p>
      </div>

      <div className="mt-8 mx-auto max-w-3xl">
        <div className="flex items-stretch gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition">
          <span className="flex items-center text-gray-300 text-base" aria-hidden="true">✱</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예) Hotfix 배포 시 QA 우선순위는 어떻게 정하나요?"
            data-testid="senior-hero-input"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            data-testid="senior-hero-submit"
            className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            전송 ↗
          </button>
        </div>
      </div>
    </section>
  );
}
