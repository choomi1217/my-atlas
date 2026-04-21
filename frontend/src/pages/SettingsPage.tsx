import { useState, useEffect, useCallback } from 'react'
import { settingsApi } from '@/api/settings'
import { SystemSettings, UpdateSettingsRequest } from '@/types/settings'
import UserManagementSection from '@/components/settings/UserManagementSection'
import AiSettingsSection from '@/components/settings/AiSettingsSection'
import SessionSettingsSection from '@/components/settings/SessionSettingsSection'

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await settingsApi.getSettings()
      setSettings(data)
    } catch {
      setError('Failed to load settings')
    }
  }

  const handleUpdateSettings = useCallback(async (request: UpdateSettingsRequest) => {
    setError('')
    try {
      const updated = await settingsApi.updateSettings(request)
      setSettings(updated)
    } catch {
      setError('Failed to update settings')
    }
  }, [])

  if (!settings) {
    return <div className="text-sm text-gray-500">Loading settings...</div>
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <UserManagementSection />

      <AiSettingsSection settings={settings} onUpdate={handleUpdateSettings} />

      <SessionSettingsSection settings={settings} onUpdate={handleUpdateSettings} />
    </div>
  )
}
