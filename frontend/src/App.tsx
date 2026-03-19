import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import SeniorPage from '@/pages/SeniorPage'
import KnowledgeBasePage from '@/pages/KnowledgeBasePage'
import ConventionsPage from '@/pages/ConventionsPage'
import CompanyListPage from '@/pages/features/CompanyListPage'
import ProductListPage from '@/pages/features/ProductListPage'
import FeatureListPage from '@/pages/features/FeatureListPage'
import TestCasePage from '@/pages/features/TestCasePage'
import TicketPage from '@/pages/TicketPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/senior" element={<SeniorPage />} />
        <Route path="/kb" element={<KnowledgeBasePage />} />
        <Route path="/conventions" element={<ConventionsPage />} />
        <Route path="/features" element={<CompanyListPage />} />
        <Route path="/features/companies/:companyId" element={<ProductListPage />} />
        <Route path="/features/companies/:companyId/products/:productId" element={<FeatureListPage />} />
        <Route path="/features/companies/:companyId/products/:productId/features/:featureId" element={<TestCasePage />} />
        <Route path="/ticket" element={<TicketPage />} />
      </Routes>
    </Layout>
  )
}
