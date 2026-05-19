import CareerTimeline from './CareerTimeline'

interface IntroTabProps {
  onNavigate?: (anchorId: string) => void
}

export default function IntroTab({ onNavigate }: IntroTabProps) {
  return (
    <div>
      {/* Introduce */}
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
            Introduce
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-2xl px-8 py-8">
          <h3 className="text-xl font-bold mb-5">안녕하세요. 조영미 입니다.</h3>

          <p className="text-base text-gray-600 leading-relaxed mb-4">
            3년간 백엔드 개발자로 일하며, 제가 만든 코드의 결함을 스스로 발견하기가 가장 어렵다는 것을 깨달았습니다.
          </p>

          <p className="text-base text-gray-600 leading-relaxed mb-4">
            그때 테스트의 가치를 체감했고, 지금은 제품 전반의 품질을 책임지는 QA 엔지니어로서 그 가치를 실현하고 있습니다.
          </p>

          <p className="text-base text-gray-600 leading-relaxed mb-4">
            QA 실무 경력 1년과 Playwright E2E, AI Prompt Develop 등의 기술이 있으며,
          </p>

          <p className="text-base text-gray-600 leading-relaxed">
            테스트 설계, 테스트 자동화, AI 프롬프트 엔지니어링을 다루며 AI 시대에 맞는 QA가 되기 위해 노력하고 있습니다.
          </p>
        </div>
      </section>

      {/* AI Experience */}
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
            AI Experience
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-2xl px-8 py-8 mb-5">
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            앞으로의 QA는 AI와 발을 맞춰 나가야 한다고 생각합니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            QA를 하면서 가장 크게 느낀 것은 빠른 개발 주기에 의해 QA에 병목이 생긴다는 점이었고,
          </p>
          <p className="text-base text-gray-600 leading-relaxed">
            이를 푸는 가장 현실적인 방법은 <strong>QA도 AI를 사용하는 것이라고 판단했습니다.</strong>
          </p>
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-2xl px-8 py-8 mb-5">
          <h3 className="text-xl font-bold mb-5">Test Studio — TC 설계 자동화</h3>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            <strong>QA 업무를 하며 TestCase 설계에 가장 많은 시간이 소요된다는 점을 체감했고, my-atlas에 Test Studio 기능을 만들었습니다.</strong>
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            회사 도메인을 선택한 후, Figma·PRD 같은 디자인/기획 문서를 넣으면 AI가 TC를 my-atlas 프로젝트에 자동으로 생성합니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            TC 작성에 필요한 QA 기본 지식은 Knowledge Base를 통해, 도메인 지식은 기존 TC와 word-conventions를 통해 제공합니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed">
            AI에게 일을 시키기 전에 <em>AI가 일할 수 있는 컨텍스트</em>를 먼저 제공 할 수 있게 기능을 개발했습니다.
          </p>
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-2xl px-8 py-8 mb-5">
          <h3 className="text-xl font-bold mb-5">AI의 할루시네이션 해결법 — Document Driven</h3>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            <strong>지금까지 Claude의 토큰을 MAX까지 사용해본 결과, 아직까지는 AI에 할루시네이션이 있다고 생각합니다.</strong>
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            아직까진 AI 결과를 그대로 사용하는 일은 없습니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            저는 절대 계획서를 받고 저의 컨펌이 있기 전까진 auto mode를 켜지 않습니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            먼저 마크다운 계획서를 받고, 의도와 다른 부분을 <code className="font-mono text-sm bg-violet-100 px-1.5 py-0.5 rounded">feedback.md</code>로 정리해 다시 전달합니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed">
            이 과정을 만족할 때까지 거쳐 계획서가 정돈된 뒤에 작업으로 넘어갑니다.
          </p>
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-2xl px-8 py-8 mb-5">
          <h3 className="text-xl font-bold mb-5">AI를 어떻게 테스트하지?</h3>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            <strong>"도넛으로 도넛을 막을 수는 없다" 고 저는 생각했습니다.</strong>
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            가장 어려웠던 일은 AI 결과의 검증이었습니다. AI를 다시 AI로 검증하는 것은 신뢰가 가지 않았습니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            그래서 <strong>"최소한의 구멍으로 결과를 만든 뒤, 마지막 구멍을 사람이 막는다"</strong>는 생각으로 테스트를 했습니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            실제 ProtoPie의 Document RAG AI 검증 당시, 600개가 넘는 질문 응답을 다시 AI에게 프롬프트와 함께 전달해 점수를 매기게 했습니다.
          </p>
          <p className="text-base text-gray-600 leading-relaxed">
            그 점수를 기준으로 낮은 점수의 응답은 제가 직접 확인했습니다. 그 과정에서 자연스럽게 다른 항목들도 점검되는 효과가 있었습니다.
          </p>
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-2xl px-8 py-8">
          <h3 className="text-xl font-bold mb-5">앞으로 — AI와 사람이 한 사이클을 도는 QA</h3>
          <p className="text-base text-gray-600 leading-relaxed">
            저는 <strong>"AI로 초안을 만들고, 사람이 확인하고, 테스트하고, 통계로 회고하는 문화"</strong>를 통해 빠르고 정확한 신뢰있는 QA가 되고 싶습니다.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
            Timeline
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <CareerTimeline onNavigate={onNavigate} />
      </section>

      {/* Contact */}
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
            Contact
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-2xl px-8 py-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-400 w-16 shrink-0">Phone</span>
              <span className="text-base text-gray-700">010-4449-6558</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-400 w-16 shrink-0">Email</span>
              <a href="mailto:whdudal1217@naver.com" className="text-base text-violet-500 hover:underline">
                whdudal1217@naver.com
              </a>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-400 w-16 shrink-0">Blog</span>
              <a href="https://choomi1217.github.io/" target="_blank" rel="noopener noreferrer" className="text-base text-violet-500 hover:underline">
                choomi1217.github.io
              </a>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-400 w-16 shrink-0">GitHub</span>
              <a href="https://github.com/choomi1217" target="_blank" rel="noopener noreferrer" className="text-base text-violet-500 hover:underline">
                github.com/choomi1217
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-center gap-6 mt-20 pt-10 border-t border-violet-200">
        <a
          href="/resume/조영미_자소서.pdf"
          download
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-violet-500 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
        >
          ⬇ PDF 다운로드
        </a>
        <span className="font-mono text-sm text-gray-400">whdudal1217@naver.com</span>
      </div>
    </div>
  )
}
