import { useEffect, useState } from 'react'
import { SystemSettings, UpdateSettingsRequest } from '@/types/settings'
import { useAuth } from '@/context/AuthContext'

interface AccessControlSectionProps {
  settings: SystemSettings
  onUpdate: (request: UpdateSettingsRequest) => Promise<void>
}

const RATE_LIMIT_MIN = 1
const RATE_LIMIT_MAX = 1000
const WINDOW_MIN = 60
const WINDOW_MAX = 86_400

export default function AccessControlSection({ settings, onUpdate }: AccessControlSectionProps) {
  const { setLoginRequired } = useAuth()

  const [limitInput, setLimitInput] = useState<string>(String(settings.aiRateLimitPerIp))
  const [windowInput, setWindowInput] = useState<string>(String(settings.aiRateLimitWindowSeconds))
  const [savingLimits, setSavingLimits] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setLimitInput(String(settings.aiRateLimitPerIp))
    setWindowInput(String(settings.aiRateLimitWindowSeconds))
  }, [settings.aiRateLimitPerIp, settings.aiRateLimitWindowSeconds])

  const handleToggleLoginRequired = async () => {
    const next = !settings.loginRequired
    await onUpdate({ loginRequired: next })
    setLoginRequired(next)
  }

  const handleSaveLimits = async () => {
    const limitValue = Number(limitInput)
    const windowValue = Number(windowInput)
    if (
      !Number.isFinite(limitValue) ||
      limitValue < RATE_LIMIT_MIN ||
      limitValue > RATE_LIMIT_MAX
    ) {
      setSaveError(`최대 요청 수는 ${RATE_LIMIT_MIN}~${RATE_LIMIT_MAX} 사이여야 합니다.`)
      return
    }
    if (
      !Number.isFinite(windowValue) ||
      windowValue < WINDOW_MIN ||
      windowValue > WINDOW_MAX
    ) {
      setSaveError(`윈도우(초)는 ${WINDOW_MIN}~${WINDOW_MAX} 사이여야 합니다.`)
      return
    }
    setSaveError(null)
    setSavingLimits(true)
    try {
      await onUpdate({
        aiRateLimitPerIp: limitValue,
        aiRateLimitWindowSeconds: windowValue,
      })
    } finally {
      setSavingLimits(false)
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Access Control</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
          <div>
            <p className="text-sm font-medium text-gray-900">로그인 필수</p>
            <p className="text-xs text-gray-500">
              Off: 비로그인 방문자도 조회 가능 (Resume / Features / KB / Convention / Senior)
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleLoginRequired}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.loginRequired ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
            aria-pressed={settings.loginRequired}
            aria-label="로그인 필수 토글"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.loginRequired ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900">AI Rate Limit (비로그인 IP 기준)</p>
            <p className="text-xs text-gray-500">
              동일 IP에서 윈도우 내 허용할 AI 요청 수. 로그인 사용자는 면제.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">최대 요청 수</span>
              <input
                type="number"
                min={RATE_LIMIT_MIN}
                max={RATE_LIMIT_MAX}
                value={limitInput}
                onChange={e => setLimitInput(e.target.value)}
                className="px-3 py-1.5 text-sm border rounded-md bg-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">윈도우 (초)</span>
              <input
                type="number"
                min={WINDOW_MIN}
                max={WINDOW_MAX}
                value={windowInput}
                onChange={e => setWindowInput(e.target.value)}
                className="px-3 py-1.5 text-sm border rounded-md bg-white"
              />
            </label>
          </div>
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveLimits}
              disabled={savingLimits}
              className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-md
                         hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {savingLimits ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
