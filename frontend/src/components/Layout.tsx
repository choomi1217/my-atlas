import { ReactNode } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { to: '/senior',      label: 'My Senior'         },
  { to: '/kb',          label: 'Knowledge Base'    },
  { to: '/conventions', label: 'Word Conventions'  },
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
    <div className="min-h-screen bg-gray-50">
      {/* GNB — Sticky */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-6">
          {/* Logo */}
          <Link to="/" className="flex items-baseline gap-2 shrink-0 hover:opacity-70 transition-opacity">
            <span className="text-lg font-bold text-indigo-600">my-atlas</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'text-indigo-600 font-semibold bg-indigo-50'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User */}
          {user && (
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-gray-500">{user.username}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}
