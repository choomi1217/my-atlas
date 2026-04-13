export default function IntroTab() {
  return (
    <div>
      {/* About Me */}
      <div className="mb-14">
        <div className="flex items-center gap-3.5 mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-gray-900">
            About Me
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-7 py-7 mb-5">
          <h3 className="text-lg font-bold mb-4">지원 동기</h3>
          <p className="text-base text-gray-600 leading-loose">
            {/* 내용을 채워주세요 */}
          </p>
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-7 py-7 mb-5">
          <h3 className="text-lg font-bold mb-4">QA로의 전환</h3>
          <p className="text-base text-gray-600 leading-loose">
            {/* 내용을 채워주세요 */}
          </p>
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-7 py-7 mb-5">
          <h3 className="text-lg font-bold mb-4">강점</h3>
          <p className="text-base text-gray-600 leading-loose">
            {/* 내용을 채워주세요 */}
          </p>
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-7 py-7 mb-5">
          <h3 className="text-lg font-bold mb-4">앞으로의 방향</h3>
          <p className="text-base text-gray-600 leading-loose">
            {/* 내용을 채워주세요 */}
          </p>
        </div>
      </div>

      <div className="text-center font-mono text-xs text-gray-400 mt-16 pt-8 border-t border-violet-200">
        choomi1217@gmail.com
      </div>
    </div>
  )
}
