import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { WeightPage } from '@/pages/WeightPage'

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<WeightPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
