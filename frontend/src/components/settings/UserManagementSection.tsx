import { useState, useEffect } from 'react'
import { settingsApi } from '@/api/settings'
import { UserWithCompanies, CompanyInfo } from '@/types/settings'
import { apiClient } from '@/api/client'

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface CompanyResponse {
  id: number
  name: string
}

export default function UserManagementSection() {
  const [users, setUsers] = useState<UserWithCompanies[]>([])
  const [companies, setCompanies] = useState<CompanyResponse[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editCompanyIds, setEditCompanyIds] = useState<number[]>([])
  const [form, setForm] = useState({ username: '', password: '', companyIds: [] as number[] })
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [usersData, companiesRes] = await Promise.all([
        settingsApi.getUsers(),
        apiClient.get<ApiResponse<CompanyResponse[]>>('/api/companies'),
      ])
      setUsers(usersData)
      setCompanies(companiesRes.data.data)
    } catch {
      setError('Failed to load data')
    }
  }

  const handleRegister = async () => {
    setError('')
    try {
      await settingsApi.registerUser(form)
      setForm({ username: '', password: '', companyIds: [] })
      setShowForm(false)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setError(msg)
    }
  }

  const handleUpdateCompanies = async (userId: number) => {
    try {
      await settingsApi.updateUserCompanies(userId, { companyIds: editCompanyIds })
      setEditingUserId(null)
      await loadData()
    } catch {
      setError('Failed to update companies')
    }
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('Delete this user?')) return
    try {
      await settingsApi.deleteUser(userId)
      await loadData()
    } catch {
      setError('Failed to delete user')
    }
  }

  const toggleCompanyId = (ids: number[], setIds: (ids: number[]) => void, id: number) => {
    setIds(ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ Register User'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          <div>
            <p className="text-sm text-gray-600 mb-1">Assign Companies:</p>
            <div className="flex flex-wrap gap-2">
              {companies.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCompanyId(form.companyIds, ids => setForm({ ...form, companyIds: ids }), c.id)}
                  className={`px-2 py-1 text-xs rounded-full border ${
                    form.companyIds.includes(c.id)
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                      : 'bg-white border-gray-300 text-gray-600'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleRegister}
            disabled={!form.username || !form.password}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            Register
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Username</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Companies</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    u.role === 'ADMIN' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {editingUserId === u.id ? (
                    <div className="flex flex-wrap gap-1">
                      {companies.map(c => (
                        <button
                          key={c.id}
                          onClick={() => toggleCompanyId(editCompanyIds, setEditCompanyIds, c.id)}
                          className={`px-2 py-0.5 text-xs rounded-full border ${
                            editCompanyIds.includes(c.id)
                              ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                              : 'bg-white border-gray-300 text-gray-500'
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-600">
                      {u.role === 'ADMIN' ? 'All' : u.companies.map((c: CompanyInfo) => c.name).join(', ') || '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.role !== 'ADMIN' && (
                    <div className="flex items-center justify-end gap-2">
                      {editingUserId === u.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateCompanies(u.id)}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingUserId(u.id)
                              setEditCompanyIds(u.companies.map((c: CompanyInfo) => c.id))
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
