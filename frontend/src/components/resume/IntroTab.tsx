import CareerTimeline from './CareerTimeline'

interface IntroTabProps {
  onNavigate?: (anchorId: string) => void
}

export default function IntroTab({ onNavigate }: IntroTabProps) {
  return (
    <div>
      {/* Introduce */}
      <section className="mb-14">
        <div className="flex items-center gap-3.5 mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-gray-900">
            Introduce
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-7 py-7">
          <h3 className="text-lg font-bold mb-4">안녕하세요. 조영미입니다.</h3>
          <p className="text-base text-gray-600 leading-loose">
            3년간 Java 백엔드 개발을 하며 테스트 코드의 가치를 직접 체감하고, QA로 전향한 엔지니어입니다.<br />
            Studio XID에서 Test Engineer로 근무하며, Project Release를 계획했으며, 다양한 테스트를 수행했습니다.<br />
            개발 경험을 바탕으로 API 스크립트 자동화, Playwright E2E 아키텍처 설계 등 기술적인 QA를 실천하고 있습니다.<br />
            개인 프로젝트(my-atlas)에서는 Spring Boot + React + Playwright + RAG 기반의 QA 지식 관리 시스템을 직접 설계·개발·테스트하고 있습니다.<br />
            반복되는 일은 자동화를 통해 팀의 품질을 높이는 일에 관심이 많습니다.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="mb-14">
        <div className="flex items-center gap-3.5 mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-gray-900">
            Timeline
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <CareerTimeline onNavigate={onNavigate} />
      </section>

      {/* Contact */}
      <section className="mb-14">
        <div className="flex items-center gap-3.5 mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-gray-900">
            Contact
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-7 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-400 w-16 shrink-0">Phone</span>
              <span className="text-sm text-gray-700">010-4449-6558</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-400 w-16 shrink-0">Email</span>
              <a href="mailto:whdudal1217@naver.com" className="text-sm text-violet-500 hover:underline">
                whdudal1217@naver.com
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-400 w-16 shrink-0">Blog</span>
              <a href="https://choomi1217.github.io/" target="_blank" rel="noopener noreferrer" className="text-sm text-violet-500 hover:underline">
                choomi1217.github.io
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-400 w-16 shrink-0">GitHub</span>
              <a href="https://github.com/choomi1217" target="_blank" rel="noopener noreferrer" className="text-sm text-violet-500 hover:underline">
                github.com/choomi1217
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="text-center font-mono text-xs text-gray-400 mt-16 pt-8 border-t border-violet-200">
        choomi1217@gmail.com
      </div>
    </div>
  )
}
