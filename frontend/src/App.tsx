import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import SeniorPage from '@/pages/SeniorPage'
import KnowledgeBasePage from '@/pages/KnowledgeBasePage'
import ConventionsPage from '@/pages/ConventionsPage'
import CompanyListPage from '@/pages/features/CompanyListPage'
import ProductListPage from '@/pages/features/ProductListPage'
import TestCasePage from '@/pages/features/TestCasePage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/senior" element={<SeniorPage />} />
        <Route path="/kb" element={<KnowledgeBasePage />} />
        <Route path="/conventions" element={<ConventionsPage />} />
        <Route path="/features" element={<CompanyListPage />} />
        <Route path="/features/companies/:companyId" element={<ProductListPage />} />
        <Route path="/features/companies/:companyId/products/:productId" element={<TestCasePage />} />
      </Routes>
    </Layout>
  )
}
