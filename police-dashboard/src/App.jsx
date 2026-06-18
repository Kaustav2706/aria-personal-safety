import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import { Shield, Map, History, FileText, AlertTriangle } from 'lucide-react';

// Pages imports
import Dashboard from './pages/Dashboard.jsx';
import LiveMap from './pages/LiveMap.jsx';
import IncidentLog from './pages/IncidentLog.jsx';
import ReportView from './pages/ReportView.jsx';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Header Dispatch Navigation */}
        <header className="sticky top-0 z-50 border-b flex items-center justify-between px-6 py-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 rounded-lg text-white">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">ARIA</h1>
              <p className="text-xs font-semibold text-rose-500 tracking-wider uppercase">POLICE DISPATCH CENTER</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1">
            <NavLink 
              to="/" 
              className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition ${isActive ? 'bg-rose-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              <Shield size={16} />
              Overview
            </NavLink>
            <NavLink 
              to="/map" 
              className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition ${isActive ? 'bg-rose-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              <Map size={16} />
              Live Map
            </NavLink>
            <NavLink 
              to="/logs" 
              className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition ${isActive ? 'bg-rose-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              <History size={16} />
              Incidents Log
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider text-rose-500 bg-rose-950/20 border-rose-900/30">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              Live Feed
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/map" element={<LiveMap />} />
            <Route path="/logs" element={<IncidentLog />} />
            <Route path="/reports/:id" element={<ReportView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
