import FeaturesSection from '@/components/overview/FeaturesSection'
import OpsSection from '@/components/overview/OpsSection'
import ReleaseProcessSection from '@/components/overview/ReleaseProcessSection'
import FuturePlansSection from '@/components/overview/FuturePlansSection'

export default function OverviewPage() {
  return (
    <div className="py-10">
      {/* Hero */}
      <div className="mb-24">
        <p className="text-base font-medium text-indigo-500 tracking-wide mb-6">QA Toolkit</p>
        <div className="text-xl text-gray-500 leading-relaxed max-w-2xl space-y-1">
          <p>QA 프로세스 개선을 위해 직접 설계하고 구현한 풀스택 프로젝트입니다.</p>
          <p>테스트 전략 수립부터 AI 기반 지식 관리, 릴리즈 파이프라인까지.</p>
          <p>반복되는 일을 자동화하고, 팀의 품질 기준을 코드로 만듭니다.</p>
        </div>
        <div className="flex flex-wrap gap-2.5 mt-10">
          {['Spring Boot 3', 'React 18', 'PostgreSQL + pgvector', 'Playwright', 'Claude AI', 'AWS'].map((tag) => (
            <span
              key={tag}
              className="text-sm font-medium text-gray-500 bg-gray-100 px-4 py-2 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-24">
        <FeaturesSection />
        <ReleaseProcessSection />
        <OpsSection />
        <FuturePlansSection />
      </div>
    </div>
  )
}
