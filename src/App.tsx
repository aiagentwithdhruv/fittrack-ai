import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import Workout from './pages/Workout'
import Dashboard from './pages/Dashboard'
import Nutrition from './pages/Nutrition'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--color-deep-space)]">
      <Routes>
        <Route path="/" element={<Workout />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <NavBar />
    </div>
  )
}
