import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  Terminal, 
  Search, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  RefreshCw,
  Wifi,
  WifiOff,
  Sun,
  Moon
} from 'lucide-react';

import BorrowerList from './components/BorrowerList';
import MetricsCharts from './components/MetricsCharts';
import Timeline from './components/Timeline';
import StatsOverview from './components/StatsOverview';
import Playground from './components/Playground';
import ComplianceAudit from './components/ComplianceAudit';

// Import our synthetic run output directly as fallback
import initialRunData from './assets/sample_run_output.json';

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [selectedBorrower, setSelectedBorrower] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [runData, setRunData] = useState(initialRunData);
  const [serverOnline, setServerOnline] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };


  const fetchBorrowers = async () => {
    try {
      const response = await fetch('/api/borrowers');
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setRunData(prevData => {
            if (JSON.stringify(prevData) === JSON.stringify(data)) {
              return prevData;
            }
            return data;
          });
        }
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch (error) {
      setServerOnline(false);
    }
  };

  const handleResetPortfolio = async () => {
    if (!window.confirm("Are you sure you want to reset the portfolio? This will clear all simulated borrowers and restore defaults.")) return;
    setResetting(true);
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.data) {
          setRunData(result.data);
          alert("Portfolio reset successfully!");
        }
      } else {
        alert("Failed to reset portfolio.");
      }
    } catch (error) {
      console.error("Error resetting portfolio:", error);
      alert("Could not connect to FastAPI server to reset portfolio.");
    } finally {
      setResetting(false);
    }
  };

  // Poll server status/load data on mount
  useEffect(() => {
    fetchBorrowers();
    const interval = setInterval(fetchBorrowers, 10000);
    return () => clearInterval(interval);
  }, []);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // Reset selected borrower when tab changes
  useEffect(() => {
    setSelectedBorrower(null);
  }, [activeTab]);

  // Extract all unique final states for filter dropdown
  const uniqueStates = Array.from(
    new Set(runData.map((b) => b.metrics?.current_state).filter(Boolean))
  );

  // Apply filters
  const filteredData = runData.filter((b) => {
    const matchesSearch = 
      b.borrower_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.persona_notes && b.persona_notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesTier = tierFilter === '' || b.metrics?.tier === tierFilter;
    const matchesState = stateFilter === '' || b.metrics?.current_state === stateFilter;
    
    return matchesSearch && matchesTier && matchesState;
  });

  // Automatically select the first borrower of the filtered list if none is selected
  useEffect(() => {
    if (filteredData.length > 0 && !selectedBorrower) {
      setSelectedBorrower(filteredData[0]);
    } else if (filteredData.length === 0) {
      setSelectedBorrower(null);
    } else if (selectedBorrower) {
      // Keep selection in sync if data changes
      const updated = filteredData.find(b => b.borrower_id === selectedBorrower.borrower_id);
      if (updated) {
        setSelectedBorrower(updated);
      } else {
        setSelectedBorrower(filteredData[0]);
      }
    }
  }, [searchTerm, tierFilter, stateFilter]);

  return (
    <div className="container">
      {/* Premium Header */}
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Riverline Risk Intelligence</h1>
            <p>Auditable state-machine analytics for automated debt collections</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {serverOnline ? (
              <div className="glass" style={{ padding: '0.5rem 1.0rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)', background: 'rgba(16, 185, 129, 0.05)' }}>
                <span className="pulse-dot green-pulse"></span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Wifi size={14} /> Server Live
                </span>
              </div>
            ) : (
              <div className="glass" style={{ padding: '0.5rem 1.0rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', border: '1px solid rgba(217, 119, 6, 0.25)', background: 'rgba(217, 119, 6, 0.05)' }}>
                <span className="pulse-dot amber-pulse"></span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--tier-amber)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <WifiOff size={14} /> Offline Fallback
                </span>
              </div>
            )}
            <div className="glass" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px' }}>
              <Sparkles size={16} className="text-blue" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vite Active</span>
            </div>
            <button 
              onClick={toggleTheme} 
              className="glass" 
              style={{ 
                width: '40px', 
                height: '40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                borderRadius: '12px',
                cursor: 'pointer',
                color: 'var(--accent-orange)'
              }}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Tabs Menu */}
      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={18} /> Portfolio Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={18} /> Performance Analytics
        </button>
        <button 
          className={`tab-btn ${activeTab === 'compliance' ? 'active' : ''}`}
          onClick={() => setActiveTab('compliance')}
        >
          <ShieldAlert size={18} /> Compliance Audit
        </button>
        <button 
          className={`tab-btn ${activeTab === 'playground' ? 'active' : ''}`}
          onClick={() => setActiveTab('playground')}
        >
          <Terminal size={18} /> Simulation Console
        </button>
      </div>

      {/* Render Active Tab content */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats Cards Row */}
          <StatsOverview data={runData} />

          {/* Search and Filters panel */}
          <div className="glass card filter-panel" style={{ padding: '1.25rem', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1' }}>
              <SlidersHorizontal size={18} />
              <strong style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter Tools</strong>
            </div>
            
            <div className="search-wrapper">
              <input 
                type="text" 
                placeholder="Search Account ID or Persona..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <select 
              value={tierFilter} 
              onChange={(e) => setTierFilter(e.target.value)}
              className="select-filter"
            >
              <option value="">All Tiers</option>
              <option value="Green">Green Tier</option>
              <option value="Amber">Amber Tier</option>
              <option value="Red">Red Tier</option>
            </select>

            <select 
              value={stateFilter} 
              onChange={(e) => setStateFilter(e.target.value)}
              className="select-filter"
            >
              <option value="">All States</option>
              {uniqueStates.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {serverOnline && (
              <button 
                onClick={handleResetPortfolio} 
                disabled={resetting}
                className="glass" 
                style={{ 
                  marginLeft: 'auto', 
                  padding: '0.6rem 1rem', 
                  borderRadius: '10px', 
                  border: '1px solid rgba(244, 63, 94, 0.2)', 
                  color: '#fb7185', 
                  background: 'rgba(244, 63, 94, 0.05)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
              >
                <RefreshCw size={15} className={resetting ? "spin-icon" : ""} />
                {resetting ? "Resetting..." : "Reset Portfolio"}
              </button>
            )}
          </div>

          {/* Split Screen Portfolio Drilldown */}
          <div className="dashboard-grid-layout">
            <div style={{ height: 'calc(100vh - 360px)', minHeight: '500px' }}>
              <BorrowerList 
                data={filteredData} 
                onSelectBorrower={setSelectedBorrower}
                selectedBorrowerId={selectedBorrower?.borrower_id}
              />
            </div>
            
            <div className="timeline-scroll-parent" style={{ height: 'calc(100vh - 360px)', minHeight: '500px', overflowY: 'auto' }}>
              {selectedBorrower ? (
                <Timeline borrower={selectedBorrower} />
              ) : (
                <div className="glass card detail-view-placeholder">
                  <ChevronRight size={48} style={{ transform: 'rotate(90deg)', opacity: 0.2, marginBottom: '1rem' }} />
                  <p style={{ color: '#64748b' }}>Select a borrower from the portfolio list to inspect their call lifecycle thread.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <MetricsCharts data={filteredData} />
      )}

      {activeTab === 'compliance' && (
        <ComplianceAudit 
          data={runData} 
          onSelectBorrower={(borrower) => {
            setSelectedBorrower(borrower);
            setActiveTab('overview');
          }} 
        />
      )}

      {activeTab === 'playground' && (
        <Playground onDataUpdated={fetchBorrowers} />
      )}
    </div>
  );
}

export default App;
