export interface AiUsageSummary {
  totalCalls: number
  totalTokens: number
  totalCost: number
  successCount: number
  failureCount: number
  byProvider: ProviderSummary[]
  byFeature: FeatureUsage[]
}

export interface ProviderSummary {
  provider: string
  calls: number
  tokens: number
  cost: number
}

export interface FeatureUsage {
  feature: string
  provider: string
  calls: number
  inputTokens: number
  outputTokens: number
  cost: number
  avgDurationMs: number
}

export interface DailyTrend {
  date: string
  calls: number
  tokens: number
  cost: number
}

export interface ApiAccessSummary {
  totalRequests: number
  byFeature: FeatureAccessCount[]
  topEndpoints: EndpointAccessCount[]
}

export interface FeatureAccessCount {
  feature: string
  count: number
}

export interface EndpointAccessCount {
  method: string
  uri: string
  count: number
}
