import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import SeniorPage from '@/pages/SeniorPage'
import KnowledgeBasePage from '@/pages/KnowledgeBasePage'
import ConventionsPage from '@/pages/ConventionsPage'
import FeaturesPage from '@/pages/FeaturesPage'
import TicketPage from '@/pages/TicketPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/senior" element={<SeniorPage />} />
        <Route path="/kb" element={<KnowledgeBasePage />} />
        <Route path="/conventions" element={<ConventionsPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/ticket" element={<TicketPage />} />
      </Routes>
    </Layout>
  )
}
