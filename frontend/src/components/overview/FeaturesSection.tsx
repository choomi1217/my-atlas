import { Link } from 'react-router-dom'

const features = [
  {
    name: 'My Senior',
    lines: ['QA 업무중 고민이 되었던 것을 질문할 수 있는 LLM 채팅 기능입니다.', 
      'Knowledge Base에 등록한 문서를 기반으로 대답해줍니다.', 
      '기존 AI들이 부정확한 지식을 알려주는 것이 싫어 개발하게 되었습니다!!'],
    slug: 'senior',
    tags: ['Claude', 'Spring AI', 'RAG', 'SSE'],
  },
  {
    name: 'Knowledge Base',
    lines: [
      'QA에 대한 정보를 등록합니다.',
      '기존 AI의 할루시네이션을 걸러내기 위해 개발하게 되었습니다!!',
      '등록한 정보는 AI 채팅시 컨텍스트로 주입되어 답변받게 됩니다.',
      '등록한 정보는 AI가 TC 자동 생성시 컨텍스트로 주입되어 보다 정확한 TC를 만들게 됩니다.'
    ],
    slug: 'kb',
    tags: ['OpenAI Embedding'],
  },
  {
    name: 'Word Conventions',
    lines: ['서로간의 용어 불일치를 방지하고 싶어서 개발하게 되었습니다!!',
      '용어를 등록할 수 있는 백과사전입니다.'
    ],
    slug: 'conventions',
    tags: [''],
  },
  {
    name: 'Product Test Suite',
    lines: ['테스트를 편하고 쉽게 하고 싶어서 개발하게 되었습니다!!', 
      'TC 등록, Version 계획, Phase 계획, 테스트 수행, 버그 티켓 발행, Version 통계를 한번에 관리 할 수 있는 만능 툴을 만들고 싶었습니다.'],
    slug: 'test-suite',
    tags: [''],
  },
  {
    name: 'Test Studio',
    lines: [
      'AI로 개발 속도가 가속화된 요즘, QA의 TC 설계에서 병목이 생긴다고 느껴 개발하게 되었습니다!!',
      'PRD/Figma 문서 등록 → Claude AI가 Knowledge Base + Company Domain을 이용해 DRAFT TC를 생성합니다.'],
    slug: 'test-studio',
    tags: ['Claude API', 'RAG', '@Async Worker'],
  },
  {
    name: 'Playwright E2E & Git Action Ci/Cd PipeLine',
    lines: ['Unit, Integration, E2E, CI/CD 자동화 파이프라인을 구축했습니다!!',
      '매번 테스트를 통해 모든 버그를 막는것은 어려우니, CI/CD에 최소한의 Smoke Test를 Code로 넣어 파이프라인을 구축했습니다.'
    ],
    slug: 'qa',
    tags: ['Playwright', 'Testcontainers', 'JUnit 5', 'JaCoCo'],
  },
]

export default function FeaturesSection() {
  return (
    <section>
      <div className="flex items-center gap-4 mb-8">
        <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
          Features
        </span>
        <div className="flex-1 h-px bg-indigo-200" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {features.map((f) => (
          <Link
            key={f.slug}
            to={`/feature/${f.slug}`}
            className="group block border border-gray-200 rounded-2xl px-7 py-6 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {f.name}
            </h3>
            <div className="mt-2 space-y-0.5">
              {f.lines.map((line, i) => (
                <p key={i} className="text-base text-gray-500 leading-relaxed">{line}</p>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {f.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
