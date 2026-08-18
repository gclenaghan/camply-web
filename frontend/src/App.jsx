import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import SearchDetail from './pages/SearchDetail.jsx'
import SearchForm from './pages/SearchForm.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <a href="/" className="app-logo">
          <span className="app-logo-icon">⛺</span>
          <span className="app-logo-text">camply web</span>
        </a>
        <nav className="app-nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/searches/new" element={<SearchForm />} />
          <Route path="/searches/:id" element={<SearchDetail />} />
          <Route path="/searches/:id/edit" element={<SearchForm />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
