import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DailyTrend } from '@/types/monitoring'

interface Props {
  data: DailyTrend[]
}

export default function DailyTrendChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No data for selected period</p>
  }

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    tokens: d.tokens,
    cost: Number(d.cost),
    calls: d.calls,
  }))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Token Usage</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="tokens" stroke="#6366f1" name="Tokens" strokeWidth={2} dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#10b981" name="Cost ($)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
