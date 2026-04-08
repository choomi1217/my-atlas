import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import SeniorPage from '@/pages/SeniorPage'
import KnowledgeBasePage from '@/pages/KnowledgeBasePage'
import ConventionsPage from '@/pages/ConventionsPage'
import CompanyListPage from '@/pages/features/CompanyListPage'
import ProductListPage from '@/pages/features/ProductListPage'
import TestCasePage from '@/pages/features/TestCasePage'
import TestRunListPage from '@/pages/features/TestRunListPage'
import VersionListPage from '@/pages/features/VersionListPage'
import VersionDetailPage from '@/pages/features/VersionDetailPage'
import VersionPhaseDetailPage from '@/pages/features/VersionPhaseDetailPage'

export default function App() {
  return (
    <Routes>
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/senior" element={<SeniorPage />} />
              <Route path="/kb" element={<KnowledgeBasePage />} />
              <Route path="/conventions" element={<ConventionsPage />} />
              <Route path="/features" element={<CompanyListPage />} />
              <Route path="/features/companies/:companyId" element={<ProductListPage />} />
              <Route path="/features/companies/:companyId/products/:productId" element={<TestCasePage />} />
              <Route path="/features/companies/:companyId/products/:productId/test-runs" element={<TestRunListPage />} />
              <Route path="/features/companies/:companyId/products/:productId/versions" element={<VersionListPage />} />
              <Route path="/features/companies/:companyId/products/:productId/versions/:versionId" element={<VersionDetailPage />} />
              <Route path="/features/companies/:companyId/products/:productId/versions/:versionId/phases/:phaseId" element={<VersionPhaseDetailPage />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}
