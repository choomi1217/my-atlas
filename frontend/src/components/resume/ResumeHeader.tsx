export default function ResumeHeader() {
  return (
    <div className="pb-10 border-b-2 border-violet-500">
      <h1 className="text-3xl font-bold tracking-tight mb-3">조영미</h1>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="inline-block text-sm font-medium text-violet-500 bg-violet-50 px-4 py-1.5 rounded-full mb-2.5">
            QA Engineer
          </span>
          <div className="flex gap-5">
            <span className="font-mono text-sm text-gray-400">choomi1217@gmail.com</span>
          </div>
        </div>
        <div className="md:text-right">
          <div className="font-mono text-3xl font-medium leading-none">4Y 4M</div>
          <div className="text-xs text-gray-400 mt-1">개발 3년 · QA 1년</div>
        </div>
      </div>
    </div>
  )
}
