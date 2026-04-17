import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import SeniorPage from '@/pages/SeniorPage'
import KnowledgeBasePage from '@/pages/KnowledgeBasePage'
import KbWritePage from '@/pages/KbWritePage'
import KbDetailPage from '@/pages/KbDetailPage'
import KbEditPage from '@/pages/KbEditPage'
import ConventionsPage from '@/pages/ConventionsPage'
import ConventionFormPage from '@/pages/ConventionFormPage'
import CompanyListPage from '@/pages/features/CompanyListPage'
import ProductListPage from '@/pages/features/ProductListPage'
import TestCasePage from '@/pages/features/TestCasePage'
import TestStudioPage from '@/pages/features/TestStudioPage'
import TestRunListPage from '@/pages/features/TestRunListPage'
import TestRunDetailPage from '@/pages/features/TestRunDetailPage'
import VersionListPage from '@/pages/features/VersionListPage'
import VersionDetailPage from '@/pages/features/VersionDetailPage'
import VersionPhaseDetailPage from '@/pages/features/VersionPhaseDetailPage'
import ResumePage from '@/pages/ResumePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/senior" replace />} />
                <Route path="/senior" element={<SeniorPage />} />
                <Route path="/kb" element={<KnowledgeBasePage />} />
                <Route path="/kb/write" element={<KbWritePage />} />
                <Route path="/kb/:id" element={<KbDetailPage />} />
                <Route path="/kb/edit/:id" element={<KbEditPage />} />
                <Route path="/conventions/new" element={<ConventionFormPage />} />
                <Route path="/conventions/:id" element={<ConventionFormPage />} />
                <Route path="/conventions" element={<ConventionsPage />} />
                <Route path="/features" element={<CompanyListPage />} />
                <Route path="/features/companies/:companyId" element={<ProductListPage />} />
                <Route path="/features/companies/:companyId/products/:productId" element={<TestCasePage />} />
                <Route path="/features/companies/:companyId/products/:productId/test-studio" element={<TestStudioPage />} />
                <Route path="/features/companies/:companyId/products/:productId/test-runs" element={<TestRunListPage />} />
                <Route path="/features/companies/:companyId/products/:productId/test-runs/:testRunId" element={<TestRunDetailPage />} />
                <Route path="/features/companies/:companyId/products/:productId/versions" element={<VersionListPage />} />
                <Route path="/features/companies/:companyId/products/:productId/versions/:versionId" element={<VersionDetailPage />} />
                <Route path="/features/companies/:companyId/products/:productId/versions/:versionId/phases/:phaseId" element={<VersionPhaseDetailPage />} />
                <Route path="/resume" element={<ResumePage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
