import ImageRefText from './ImageRefText';
import { TestStep, TestCaseImage } from '@/types/features';

interface TestCaseStepsProps {
  steps: TestStep[];
  images?: TestCaseImage[];
}

export default function TestCaseSteps({ steps, images }: TestCaseStepsProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <section className="mt-4 bg-gray-50 rounded-md p-3" data-testid="tc-steps">
      <header className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2 px-1">
        Steps
      </header>
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div
            key={idx}
            data-testid="tc-step-row"
            className="grid grid-cols-[32px_1fr_1fr] gap-3 p-3 bg-white rounded border border-gray-100"
          >
            <div className="flex items-start">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                {idx + 1}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400 block mb-1">
                Action
              </span>
              <span className="text-sm">
                <ImageRefText text={step.action} images={images} />
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400 block mb-1">
                Step Expected
              </span>
              <span className="text-sm text-gray-700">
                <ImageRefText text={step.expected} images={images} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
