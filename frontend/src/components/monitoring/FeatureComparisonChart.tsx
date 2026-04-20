import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { FeatureUsage } from '@/types/monitoring'

interface Props {
  data: FeatureUsage[]
}

const FEATURE_LABELS: Record<string, string> = {
  SENIOR_CHAT: 'Senior Chat',
  TC_DRAFT: 'TC Draft',
  TEST_STUDIO: 'Test Studio',
  EMBEDDING_SENIOR: 'Embed (Senior)',
  EMBEDDING_PDF: 'Embed (PDF)',
  EMBEDDING_TEST_STUDIO: 'Embed (Studio)',
}

export default function FeatureComparisonChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No data for selected period</p>
  }

  const chartData = data.map((d) => ({
    feature: FEATURE_LABELS[d.feature] || d.feature,
    cost: Number(d.cost),
    calls: d.calls,
    inputTokens: d.inputTokens,
    outputTokens: d.outputTokens,
  }))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Cost by Feature</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="feature" width={100} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => `$${Number(value).toFixed(6)}`} />
          <Legend />
          <Bar dataKey="cost" fill="#6366f1" name="Cost ($)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
