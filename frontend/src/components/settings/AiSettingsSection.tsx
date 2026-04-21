import { SystemSettings, UpdateSettingsRequest } from '@/types/settings'

interface AiSettingsSectionProps {
  settings: SystemSettings
  onUpdate: (request: UpdateSettingsRequest) => Promise<void>
}

export default function AiSettingsSection({ settings, onUpdate }: AiSettingsSectionProps) {
  const handleToggle = async () => {
    await onUpdate({ aiEnabled: !settings.aiEnabled })
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Settings</h2>
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
        <div>
          <p className="text-sm font-medium text-gray-900">AI Features</p>
          <p className="text-xs text-gray-500">Senior Chat (Claude) + KB Embedding (OpenAI)</p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.aiEnabled ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.aiEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </section>
  )
}
