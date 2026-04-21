import { SystemSettings, UpdateSettingsRequest } from '@/types/settings'

interface SessionSettingsSectionProps {
  settings: SystemSettings
  onUpdate: (request: UpdateSettingsRequest) => Promise<void>
}

const TIMEOUT_OPTIONS = [
  { label: '1 hour', value: 3600 },
  { label: '30 minutes', value: 1800 },
  { label: '10 minutes', value: 600 },
  { label: '10 seconds (Test)', value: 10 },
]

export default function SessionSettingsSection({ settings, onUpdate }: SessionSettingsSectionProps) {
  const handleChange = async (value: number) => {
    await onUpdate({ sessionTimeoutSeconds: value })
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Settings</h2>
      <div className="p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Session Timeout</p>
            <p className="text-xs text-gray-500">Auto-logout after inactivity (requires re-login to apply)</p>
          </div>
          <select
            value={settings.sessionTimeoutSeconds}
            onChange={e => handleChange(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border rounded-md bg-white"
          >
            {TIMEOUT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}
