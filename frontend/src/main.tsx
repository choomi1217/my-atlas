import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from '@/context/AuthContext'
import { ActiveCompanyProvider } from '@/context/ActiveCompanyContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ActiveCompanyProvider>
          <App />
        </ActiveCompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
