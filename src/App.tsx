import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { AIImportPage } from '@/pages/AIImportPage'
import { PlannerPage } from '@/pages/PlannerPage'

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/import" element={<AIImportPage />} />
          <Route path="/planner" element={<PlannerPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
