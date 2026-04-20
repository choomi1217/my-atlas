import type { AiUsageSummary } from '@/types/monitoring'

interface Props {
  summary: AiUsageSummary
}

export default function CostSummaryCards({ summary }: Props) {
  const successRate = summary.totalCalls > 0
    ? ((summary.successCount / summary.totalCalls) * 100).toFixed(1)
    : '0.0'

  const cards = [
    { label: 'Total Cost', value: `$${summary.totalCost.toFixed(4)}`, color: 'text-indigo-600' },
    { label: 'Total Calls', value: summary.totalCalls.toLocaleString(), color: 'text-gray-900' },
    { label: 'Total Tokens', value: summary.totalTokens.toLocaleString(), color: 'text-gray-900' },
    { label: 'Success Rate', value: `${successRate}%`, color: 'text-emerald-600' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
          <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
