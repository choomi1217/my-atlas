import { useState, useEffect, useCallback } from 'react'
import { monitoringApi } from '@/api/monitoring'
import type { AiUsageSummary, DailyTrend, ApiAccessSummary } from '@/types/monitoring'

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function useMonitoring() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [from, setFrom] = useState(formatDate(thirtyDaysAgo))
  const [to, setTo] = useState(formatDate(now))
  const [aiSummary, setAiSummary] = useState<AiUsageSummary | null>(null)
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([])
  const [apiSummary, setApiSummary] = useState<ApiAccessSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ai, trend, api] = await Promise.all([
        monitoringApi.getAiSummary(from, to),
        monitoringApi.getDailyTrend(from, to),
        monitoringApi.getApiSummary(from, to),
      ])
      setAiSummary(ai)
      setDailyTrend(trend)
      setApiSummary(api)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return {
    from, to, setFrom, setTo,
    aiSummary, dailyTrend, apiSummary,
    loading, error, refresh: fetchAll,
  }
}
