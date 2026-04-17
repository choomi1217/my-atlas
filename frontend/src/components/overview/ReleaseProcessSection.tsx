const branchFlow = [
  { branch: 'feature/*', arrow: true, description: 'Claude Worktree에서 개발' },
  { branch: 'develop', arrow: true, description: 'PR 머지 → 통합 테스트' },
  { branch: 'main', arrow: false, description: 'PR 머지 → AWS 자동 배포' },
]

const testPipeline = [
  { category: 'Backend', count: 179, detail: 'JUnit 5 + Mockito + Testcontainers' },
  { category: 'Frontend', count: 33, detail: 'Vitest + React Testing Library' },
  { category: 'E2E', count: 98, detail: 'Playwright (API 65 + UI 33)' },
]

export default function ReleaseProcessSection() {
  const totalTests = testPipeline.reduce((sum, t) => sum + t.count, 0)

  return (
    <section>
      <div className="flex items-center gap-4 mb-8">
        <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
          Release Process
        </span>
        <div className="flex-1 h-px bg-indigo-200" />
      </div>

      {/* Branch strategy */}
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        Branch Strategy
      </h4>
      <div className="flex items-center gap-3 mb-12 flex-wrap">
        {branchFlow.map((b) => (
          <div key={b.branch} className="flex items-center gap-3">
            <div className="border border-gray-200 rounded-xl px-5 py-3.5">
              <span className="font-mono text-sm font-bold text-indigo-600">{b.branch}</span>
              <p className="text-sm text-gray-500 mt-1">{b.description}</p>
            </div>
            {b.arrow && (
              <span className="text-gray-300 text-xl" aria-hidden>
                &#8594;
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Test pipeline */}
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        Test Pipeline
        <span className="ml-3 text-lg font-bold text-indigo-600 normal-case tracking-normal">{totalTests} tests</span>
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {testPipeline.map((t) => (
          <div
            key={t.category}
            className="border border-gray-200 rounded-xl px-6 py-7 text-center"
          >
            <span className="font-mono text-4xl font-bold text-indigo-600">{t.count}</span>
            <p className="text-lg font-bold text-gray-900 mt-2">{t.category}</p>
            <p className="text-sm text-gray-500 mt-1">{t.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
