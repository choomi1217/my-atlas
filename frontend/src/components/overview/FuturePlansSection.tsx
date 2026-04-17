import { futurePlans } from '@/data/featureDetails'

const difficultyColor: Record<string, string> = {
  '낮음': 'text-emerald-600 bg-emerald-50',
  '중간': 'text-amber-600 bg-amber-50',
  '높음': 'text-red-600 bg-red-50',
}

export default function FuturePlansSection() {
  return (
    <section>
      <div className="flex items-center gap-4 mb-8">
        <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
          Roadmap
        </span>
        <div className="flex-1 h-px bg-indigo-200" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {futurePlans.map((p) => (
          <div
            key={p.name}
            className="border border-gray-200 rounded-xl px-6 py-5"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-gray-900">{p.name}</h3>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${difficultyColor[p.difficulty] || ''}`}>
                {p.difficulty}
              </span>
            </div>
            <p className="text-sm text-gray-500">{p.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
