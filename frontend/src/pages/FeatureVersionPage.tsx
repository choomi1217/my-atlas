import { useParams, Link } from 'react-router-dom'
import { featureDetails } from '@/data/featureDetails'

export default function FeatureVersionPage() {
  const { slug, version } = useParams<{ slug: string; version: string }>()
  const feature = slug ? featureDetails[slug] : undefined
  const ver = feature?.versions.find((v) => v.version === version)

  if (!feature || !ver) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-400">Version not found.</p>
        <Link to="/" className="text-indigo-500 hover:underline mt-4 inline-block">Overview로 돌아가기</Link>
      </div>
    )
  }

  const currentIdx = feature.versions.findIndex((v) => v.version === version)
  const prev = currentIdx > 0 ? feature.versions[currentIdx - 1] : null
  const next = currentIdx < feature.versions.length - 1 ? feature.versions[currentIdx + 1] : null

  return (
    <div className="max-w-4xl mx-auto py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <Link to="/" className="hover:text-gray-600 transition-colors">Overview</Link>
        <span>/</span>
        <Link to={`/feature/${slug}`} className="hover:text-gray-600 transition-colors">{feature.name}</Link>
        <span>/</span>
        <span className="text-gray-600 font-medium">{ver.version}</span>
      </div>

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-lg font-bold text-indigo-600">{ver.version}</span>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${typeColor(ver.type)}`}>{ver.type}</span>
          <span className="text-sm text-gray-400 font-mono">{ver.date}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{ver.title}</h1>
        <p className="text-base text-gray-500">{feature.name}</p>
      </div>

      {/* Highlights */}
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">Changes</span>
          <div className="flex-1 h-px bg-indigo-200" />
        </div>
        <ul className="space-y-4">
          {ver.highlights.map((h, i) => (
            <li key={i} className="flex gap-4">
              <div className="shrink-0 w-2 h-2 rounded-full bg-indigo-400 mt-2.5" />
              <p className="text-lg text-gray-600 leading-relaxed">{h}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Navigation */}
      <div className="flex justify-between pt-8 border-t border-gray-200">
        {prev ? (
          <Link
            to={`/feature/${slug}/${prev.version}`}
            className="text-sm text-gray-400 hover:text-indigo-600 transition-colors"
          >
            &larr; {prev.version} {prev.title}
          </Link>
        ) : <div />}
        {next ? (
          <Link
            to={`/feature/${slug}/${next.version}`}
            className="text-sm text-gray-400 hover:text-indigo-600 transition-colors"
          >
            {next.version} {next.title} &rarr;
          </Link>
        ) : <div />}
      </div>
    </div>
  )
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
