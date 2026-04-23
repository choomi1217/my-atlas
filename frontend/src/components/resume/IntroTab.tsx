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
            3년간 백엔드 개발을 하며 테스트 코드의 가치를 직접 체감하고, QA로 전향한 엔지니어입니다.
          </p>

          <p className="text-base text-gray-600 leading-relaxed mb-4">
            Playwright E2E, QA에 AI 기술 적용 등 1년의 QA 경력이 있고, 발전하기 위해 노력하고 있습니다.
          </p>

          <p className="text-base text-gray-600 leading-relaxed mb-4">
            테스트 자동화부터 백엔드 설계, AI 프롬프트 엔지니어링까지 전 영역을 다루며, QA 시스템을 구축하고 있습니다.
          </p>

          <p className="text-base text-gray-600 leading-relaxed">
            현재 QA 문화를 진화시키는것에 집중하고 있습니다.
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
