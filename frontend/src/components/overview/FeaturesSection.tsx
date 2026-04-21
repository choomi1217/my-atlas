import { Link } from 'react-router-dom'

const features = [
  {
    name: 'My Senior',
    lines: ['AI 시니어 QA 챗봇.', 'RAG 기반 답변과 SSE 스트리밍, FAQ 카드뷰를 제공한다.'],
    slug: 'senior',
    tags: ['RAG', 'SSE', 'Spring AI', 'Claude'],
  },
  {
    name: 'Knowledge Base',
    lines: ['QA 지식 CRUD와 PDF 업로드 파이프라인.', '청킹, 임베딩, 벡터 검색을 지원한다.'],
    slug: 'kb',
    tags: ['PDF', 'pgvector', 'OpenAI Embedding'],
  },
  {
    name: 'Word Conventions',
    lines: ['팀 용어 표준화 사전.', '이미지 첨부와 검색을 지원한다.'],
    slug: 'conventions',
    tags: ['CRUD', 'Image Upload'],
  },
  {
    name: 'Product Test Suite',
    lines: ['Company > Product > TestCase 3단계 드릴다운.', 'Segment 트리, Version/Phase, Jira 자동 연동.'],
    slug: 'test-suite',
    tags: ['DnD', 'Adjacency List', 'JSONB', 'Jira API'],
  },
  {
    name: 'Test Studio',
    lines: ['문서 → Claude RAG → DRAFT TestCase 자동 생성.', 'Segment Path 추천 + 1클릭 적용 UX.'],
    slug: 'test-studio',
    tags: ['Claude API', 'RAG', '@Async Worker'],
  },
  {
    name: 'QA Strategy',
    lines: ['4계층 테스트 피라미드 구축.', 'Unit, Integration, E2E, CI/CD 자동화 파이프라인.'],
    slug: 'qa',
    tags: ['JUnit 5', 'Playwright', 'Testcontainers', 'JaCoCo'],
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
