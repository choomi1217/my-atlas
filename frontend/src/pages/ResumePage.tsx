import { useState } from 'react'
import ResumeHeader from '@/components/resume/ResumeHeader'
import WorkExpTab from '@/components/resume/WorkExpTab'
import IntroTab from '@/components/resume/IntroTab'

type Tab = 'work-exp' | 'intro'

export default function ResumePage() {
  const [activeTab, setActiveTab] = useState<Tab>('work-exp')

  return (
    <div className="max-w-4xl mx-auto">
      <ResumeHeader />

      {/* Tab Bar */}
      <div className="flex">
        <button
          onClick={() => setActiveTab('intro')}
          className={`flex-1 text-center py-3.5 text-sm font-medium border border-violet-200 border-t-0 rounded-bl-xl transition-colors ${
            activeTab === 'intro'
              ? 'text-violet-500 bg-white font-bold border-b-transparent'
              : 'text-gray-400 bg-violet-50/50 hover:text-gray-500 hover:bg-violet-50'
          }`}
        >
          자기소개서
        </button>
        <button
          onClick={() => setActiveTab('work-exp')}
          className={`flex-1 text-center py-3.5 text-sm font-medium border border-violet-200 border-t-0 rounded-br-xl transition-colors ${
            activeTab === 'work-exp'
              ? 'text-violet-500 bg-white font-bold border-b-transparent'
              : 'text-gray-400 bg-violet-50/50 hover:text-gray-500 hover:bg-violet-50'
          }`}
        >
          경력기술서
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-12">
        {activeTab === 'work-exp' ? <WorkExpTab /> : <IntroTab />}
      </div>
    </div>
  )
}
