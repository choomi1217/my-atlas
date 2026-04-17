import { useParams, Link } from 'react-router-dom'
import { featureDetails } from '@/data/featureDetails'

export default function FeatureDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const feature = slug ? featureDetails[slug] : undefined

  if (!feature) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-400">Feature not found.</p>
        <Link to="/" className="text-indigo-500 hover:underline mt-4 inline-block">Overview로 돌아가기</Link>
      </div>
    )
  }

  const totalTests = feature.testing.reduce((sum, t) => sum + t.count, 0)

  return (
    <div className="max-w-4xl mx-auto py-10">
      <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        &larr; Overview
      </Link>

      {/* Hero */}
      <div className="mt-6 mb-16">
        <div className="flex flex-wrap gap-2.5 mb-4">
          {feature.techStack.map((t) => (
            <span key={t} className="text-xs font-medium text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">{t}</span>
          ))}
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">{feature.name}</h1>
        <p className="text-lg text-indigo-500 font-medium mb-6">{feature.tagline}</p>
        <div className="space-y-1">
          {feature.description.map((line, i) => (
            <p key={i} className="text-lg text-gray-500 leading-relaxed">{line}</p>
          ))}
        </div>
      </div>

      {/* About — Why / What / QA Benefit */}
      <section className="mb-16">
        <SectionHeader title="About" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AboutCard title="왜 만들었는가" items={feature.about.why} color="indigo" />
          <AboutCard title="어떤 기능인가" items={feature.about.what} color="emerald" />
          <AboutCard title="QA에게 좋은 점" items={feature.about.benefit} color="violet" />
        </div>
        {feature.about.screenshot && (
          <div className="mt-8 border border-gray-200 rounded-2xl overflow-hidden">
            <img src={feature.about.screenshot} alt={`${feature.name} screenshot`} className="w-full" />
          </div>
        )}
      </section>

      {/* Architecture */}
      {feature.architecture.length > 0 && (
        <section className="mb-16">
          <SectionHeader title="Architecture" />
          <ol className="space-y-3">
            {feature.architecture.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-base text-gray-600 leading-relaxed pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* API Endpoints */}
      {feature.apis.length > 0 && (
        <section className="mb-16">
          <SectionHeader title="API Endpoints" />
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Method</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Endpoint</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {feature.apis.map((api, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3">
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${methodColor(api.method)}`}>
                        {api.method}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm text-gray-700">{api.path}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{api.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Database Schema */}
      {feature.schema.length > 0 && (
        <section className="mb-16">
          <SectionHeader title="Database Schema" />
          <div className="space-y-4">
            {feature.schema.map((s, i) => (
              <div key={i} className="border border-gray-200 rounded-xl px-6 py-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm font-bold text-indigo-600">{s.table}</span>
                  <span className="text-sm text-gray-500">{s.desc}</span>
                </div>
                <p className="font-mono text-xs text-gray-400 leading-relaxed">{s.key}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testing */}
      {totalTests > 0 && (
        <section className="mb-16">
          <SectionHeader title="Testing" count={totalTests} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {feature.testing.map((t, i) => (
              <div key={i} className="border border-gray-200 rounded-xl px-6 py-5">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-base font-bold text-gray-900">{t.label}</span>
                  <span className="font-mono text-2xl font-bold text-indigo-600">{t.count}</span>
                </div>
                <p className="text-sm text-gray-500">{t.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Version History */}
      {feature.versions.length > 0 && (
        <section className="mb-16">
          <SectionHeader title="Version History" count={feature.versions.length} label="versions" />
          <div className="space-y-3">
            {[...feature.versions].reverse().map((v) => (
              <Link
                key={v.version}
                to={`/feature/${feature.slug}/${v.version}`}
                className="group block border border-gray-200 rounded-xl px-6 py-4 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm font-bold text-indigo-600">{v.version}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${typeColor(v.type)}`}>{v.type}</span>
                  <span className="text-xs text-gray-400 font-mono">{v.date}</span>
                </div>
                <p className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{v.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionHeader({ title, count, label }: { title: string; count?: number; label?: string }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">{title}</span>
      {count !== undefined && (
        <span className="text-lg font-bold text-indigo-600">{count} {label || 'tests'}</span>
      )}
      <div className="flex-1 h-px bg-indigo-200" />
    </div>
  )
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET': return 'text-emerald-700 bg-emerald-50'
    case 'POST': return 'text-blue-700 bg-blue-50'
    case 'PUT': return 'text-amber-700 bg-amber-50'
    case 'PATCH': return 'text-orange-700 bg-orange-50'
    case 'DELETE': return 'text-red-700 bg-red-50'
    default: return 'text-gray-700 bg-gray-50'
  }
}

function typeColor(type: string): string {
  switch (type) {
    case '기능 추가': return 'text-blue-700 bg-blue-50'
    case '기능 개선': return 'text-emerald-700 bg-emerald-50'
    case '버그 수정': return 'text-red-700 bg-red-50'
    case '테스트 보강': return 'text-violet-700 bg-violet-50'
    default: return 'text-gray-700 bg-gray-50'
  }
}

const cardColors = {
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50/50', title: 'text-indigo-600', dot: 'bg-indigo-400' },
  emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50/50', title: 'text-emerald-600', dot: 'bg-emerald-400' },
  violet: { border: 'border-violet-200', bg: 'bg-violet-50/50', title: 'text-violet-600', dot: 'bg-violet-400' },
} as const

function AboutCard({ title, items, color }: { title: string; items: string[]; color: keyof typeof cardColors }) {
  const c = cardColors[color]
  return (
    <div className={`border ${c.border} ${c.bg} rounded-2xl px-6 py-6`}>
      <h4 className={`text-sm font-bold uppercase tracking-wider ${c.title} mb-4`}>{title}</h4>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <div className={`shrink-0 w-1.5 h-1.5 rounded-full ${c.dot} mt-2`} />
            <p className="text-sm text-gray-600 leading-relaxed">{item}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
