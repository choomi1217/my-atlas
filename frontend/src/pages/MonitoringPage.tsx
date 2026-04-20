import { useMonitoring } from '@/hooks/useMonitoring'
import CostSummaryCards from '@/components/monitoring/CostSummaryCards'
import DailyTrendChart from '@/components/monitoring/DailyTrendChart'
import FeatureComparisonChart from '@/components/monitoring/FeatureComparisonChart'
import ApiUsagePieChart from '@/components/monitoring/ApiUsagePieChart'

export default function MonitoringPage() {
  const {
    from, to, setFrom, setTo,
    aiSummary, dailyTrend, apiSummary,
    loading, error,
  } = useMonitoring()

  return (
    <div className="space-y-6">
      {/* Header + Date Range */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Monitoring</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          />
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <p className="text-sm text-gray-400 text-center py-8">Loading monitoring data...</p>
      )}
      {error && (
        <p className="text-sm text-red-500 text-center py-4">{error}</p>
      )}

      {/* Content */}
      {!loading && aiSummary && (
        <>
          {/* Summary Cards */}
          <CostSummaryCards summary={aiSummary} />

          {/* Provider breakdown */}
          {aiSummary.byProvider.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {aiSummary.byProvider.map((p) => (
                <div key={p.provider} className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{p.provider}</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">${Number(p.cost).toFixed(4)}</p>
                  <p className="text-xs text-gray-400">{p.calls} calls / {p.tokens.toLocaleString()} tokens</p>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyTrendChart data={dailyTrend} />
            <FeatureComparisonChart data={aiSummary.byFeature} />
          </div>

          {apiSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ApiUsagePieChart data={apiSummary} />

              {/* Top Endpoints Table */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Endpoints</h3>
                {apiSummary.topEndpoints.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No data</p>
                ) : (
                  <div className="overflow-auto max-h-60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 font-medium">Method</th>
                          <th className="pb-2 font-medium">URI</th>
                          <th className="pb-2 font-medium text-right">Calls</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiSummary.topEndpoints.slice(0, 10).map((ep, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1.5">
                              <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-gray-100">
                                {ep.method}
                              </span>
                            </td>
                            <td className="py-1.5 text-gray-600 font-mono text-xs truncate max-w-[200px]">
                              {ep.uri}
                            </td>
                            <td className="py-1.5 text-right text-gray-900 font-medium">
                              {ep.count.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
