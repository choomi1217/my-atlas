const infra = [
  { label: 'Frontend', value: 'CloudFront + S3', detail: '정적 호스팅, CDN 캐싱' },
  { label: 'Backend', value: 'EC2 (t3.small)', detail: 'Docker Compose (Spring Boot + PostgreSQL)' },
  { label: 'Database', value: 'PostgreSQL 15 + pgvector', detail: '벡터 검색, Flyway 마이그레이션' },
  { label: 'CI/CD', value: 'GitHub Actions', detail: '5 workflows (build, test, deploy)' },
  { label: 'Notification', value: 'Slack Webhook', detail: 'Block Kit, 성공/실패 알림' },
]

const workflows = [
  { name: 'backend-ci', trigger: 'Push/PR → main, develop' },
  { name: 'frontend-ci', trigger: 'Push/PR → main, develop' },
  { name: 'e2e', trigger: 'Push/PR + manual' },
  { name: 'deploy-backend', trigger: 'Push → main (backend/**)' },
  { name: 'deploy-frontend', trigger: 'Push → main (frontend/**)' },
]

export default function OpsSection() {
  return (
    <section>
      <div className="flex items-center gap-4 mb-8">
        <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
          Infrastructure
        </span>
        <div className="flex-1 h-px bg-indigo-200" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {infra.map((item) => (
          <div
            key={item.label}
            className="border border-gray-200 rounded-xl px-6 py-5"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {item.label}
            </span>
            <p className="text-base font-bold text-gray-900 mt-1.5">{item.value}</p>
            <p className="text-sm text-gray-500 mt-1">{item.detail}</p>
          </div>
        ))}
      </div>

      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        CI/CD Pipelines
      </h4>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {workflows.map((w) => (
              <tr key={w.name}>
                <td className="px-5 py-3 font-mono text-sm text-indigo-600 font-medium">{w.name}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{w.trigger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
