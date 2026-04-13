import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { to: '/senior',      label: 'My Senior'        },
  { to: '/kb',          label: 'Knowledge Base'   },
  { to: '/conventions', label: 'Word Conventions' },
  { to: '/features',    label: 'Product Test Suite' },
  { to: '/resume',      label: 'Resume'             },
]

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600">my-atlas</h1>
          <p className="text-xs text-gray-400 mt-1">QA Knowledge Hub</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + Logout */}
        {user && (
          <div className="p-3 border-t border-gray-200">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-700 truncate">{user.username}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  user.role === 'ADMIN'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
