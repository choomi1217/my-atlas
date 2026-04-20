import { apiClient } from './client'
import type {
  AiUsageSummary,
  DailyTrend,
  FeatureUsage,
  ApiAccessSummary,
} from '@/types/monitoring'

const BASE = '/api/admin/monitoring'

export const monitoringApi = {
  getAiSummary: async (from: string, to: string): Promise<AiUsageSummary> => {
    const res = await apiClient.get(`${BASE}/ai-summary`, { params: { from, to } })
    return res.data.data
  },

  getDailyTrend: async (from: string, to: string): Promise<DailyTrend[]> => {
    const res = await apiClient.get(`${BASE}/ai-daily-trend`, { params: { from, to } })
    return res.data.data
  },

  getByFeature: async (from: string, to: string): Promise<FeatureUsage[]> => {
    const res = await apiClient.get(`${BASE}/ai-by-feature`, { params: { from, to } })
    return res.data.data
  },

  getApiSummary: async (from: string, to: string): Promise<ApiAccessSummary> => {
    const res = await apiClient.get(`${BASE}/api-summary`, { params: { from, to } })
    return res.data.data
  },
}
