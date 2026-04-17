import { ReleaseReadiness } from '@/types/features';

interface ReleaseReadinessCardProps {
  releaseReadiness: ReleaseReadiness;
}

export const ReleaseReadinessCard: React.FC<ReleaseReadinessCardProps> = ({ releaseReadiness }) => {
  const { ready, verdict, criteria, progress } = releaseReadiness;

  return (
    <div className={`rounded-lg border-2 p-5 ${ready ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">Release Readiness</h3>
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
          ready ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {verdict === 'GO' ? 'GO' : 'NO-GO'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Pass Rate" value={`${progress.overallPassRate}%`} />
        <KpiCard label="Open Bug" value={`${progress.fail}건`} />
        <KpiCard label="Highest" value={`${criteria.find(c => c.name.includes('Highest'))?.actual || '0건'}`} />
        <KpiCard label="진행률" value={`${progress.overallProgressRate}%`} />
      </div>

      <div className="space-y-1.5">
        {criteria.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span>{c.passed ? '\u2705' : '\u274C'}</span>
            <span className="text-gray-700">{c.name}: {c.actual}</span>
            <span className="text-gray-400">({c.threshold})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}
