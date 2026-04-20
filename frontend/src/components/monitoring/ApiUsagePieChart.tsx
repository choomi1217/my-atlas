import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ApiAccessSummary } from '@/types/monitoring'

interface Props {
  data: ApiAccessSummary
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#10b981', '#f59e0b', '#ef4444', '#6b7280']

export default function ApiUsagePieChart({ data }: Props) {
  if (data.byFeature.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No API access data</p>
  }

  const chartData = data.byFeature.map((f) => ({
    name: f.feature,
    value: f.count,
  }))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">API Calls by Feature</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={90}
            dataKey="value"
            labelLine={false}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
