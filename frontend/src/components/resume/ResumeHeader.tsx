export default function ResumeHeader() {
  return (
    <div className="pb-12">
      <h1 className="text-5xl font-bold tracking-tight mb-4">조영미</h1>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="inline-block text-base font-medium text-violet-500 bg-violet-50 px-5 py-2 rounded-full mb-3">
            QA Engineer
          </span>
          <div className="flex gap-5">
            <span className="font-mono text-base text-gray-400">whdudal1217@naver.com</span>
          </div>
        </div>
        <div className="md:text-right">
          <div className="font-mono text-5xl font-bold leading-none">4Y 4M</div>
          <div className="text-sm text-gray-400 mt-2">개발 3년 · QA 1년</div>
        </div>
      </div>
    </div>
  )
}
