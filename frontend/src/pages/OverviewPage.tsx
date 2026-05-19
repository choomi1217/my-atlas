import FeaturesSection from '@/components/overview/FeaturesSection'
import OpsSection from '@/components/overview/OpsSection'
import ReleaseProcessSection from '@/components/overview/ReleaseProcessSection'

export default function OverviewPage() {
  return (
    <div className="py-10">
      {/* Hero */}
      <div className="mb-24">
        <div className="text-xl text-gray-500 leading-relaxed max-w-4xl space-y-1 break-keep">
          <p>AI로 인해 빠르게 변하는 IT 업계의 흐름을 따라 QA도 AI를 이용해 업무를 할 수 있도록</p>
          <p>계획부터 테스트, 배포까지 AI와 함께 일할 수 있게끔 만든 프로젝트입니다.</p>
        </div>
        
      </div>

      <div className="space-y-24">
        <FeaturesSection />
        <ReleaseProcessSection />
        <OpsSection />
      </div>
    </div>
  )
}
