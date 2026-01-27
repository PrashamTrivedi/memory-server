import { useState, useEffect } from 'react';
import { TagManagement, MemoryManagement, TemporaryMemoryReview, ApiKeys, SkillDownload, McpAppsAdmin } from './pages';
import { useTheme } from './contexts/ThemeContext';
import { useMemoryStats } from './api/memory';
import { api } from './api/client';
import './App.css';
import './components/TagHierarchy.css';

type AppView = 'home' | 'tags' | 'memories' | 'temporary-memories' | 'api-keys' | 'skill-download' | 'mcp-apps';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('memories'); // Default to memories view
  const { theme, toggleTheme } = useTheme();
  const { data: stats } = useMemoryStats();
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    // Check if API key is configured
    const hasApiKey = !!api.getApiKey();
    setShowApiKeyPrompt(!hasApiKey);
  }, []);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      api.setApiKey(apiKeyInput.trim());
      setShowApiKeyPrompt(false);
      setApiKeyInput('');
      // Reload the page to refresh all data with the new key
      window.location.reload();
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'tags':
        return <TagManagement />;
      case 'memories':
        return <MemoryManagement />;
      case 'temporary-memories':
        return <TemporaryMemoryReview />;
      case 'api-keys':
        return <ApiKeys />;
      case 'skill-download':
        return <SkillDownload />;
      case 'mcp-apps':
        return <McpAppsAdmin />;
      default:
        return (
          <div className="home-view">
            <div className="welcome-section">
              <h2>Welcome to Memory Server</h2>
              <p>Your personal development knowledge repository</p>
            </div>
            
            <div className="feature-cards">
              <div className="feature-card primary-card" onClick={() => setCurrentView('memories')}>
                <h3>Memory Management</h3>
                <p>Store and organize your development knowledge, code snippets, and solutions</p>
                {stats && (
                  <div className="card-stats">
                    <span className="stat">{stats.total} memories</span>
                    <span className="stat">{stats.recent} recent</span>
                  </div>
                )}
                <ul>
                  <li>Full-text search</li>
                  <li>Tag-based organization</li>
                  <li>Rich content support</li>
                  <li>URL references</li>
                </ul>
                <button className="card-button">Manage Memories</button>
              </div>
              
              <div className="feature-card" onClick={() => setCurrentView('tags')}>
                <h3>Tag Management</h3>
                <p>Organize your knowledge with hierarchical tags and relationships</p>
                <ul>
                  <li>Visual tree editor</li>
                  <li>Parent-child relationships</li>
                  <li>Bulk operations</li>
                  <li>Tag hierarchies</li>
                </ul>
                <button className="card-button">Manage Tags</button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="App">
      {/* API Key Configuration Prompt */}
      {showApiKeyPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: theme === 'light' ? 'white' : '#1e1e1e',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
          }}>
            <h2 style={{ marginTop: 0 }}>Configure API Key</h2>
            <p style={{ marginBottom: '1rem' }}>
              To use the Memory Server UI, you need to configure an API key.
              Enter your admin API key below:
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="msk_..."
              style={{
                width: '100%',
                padding: '0.5rem',
                marginBottom: '1rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '1rem',
                fontFamily: 'monospace',
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveApiKey();
                }
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveApiKey}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Save API Key
              </button>
            </div>
            <p style={{
              marginTop: '1rem',
              fontSize: '0.875rem',
              color: theme === 'light' ? '#666' : '#999'
            }}>
              <strong>Note:</strong> For instructions on creating your first API key,
              see the <code>docs/API_KEY_MANAGEMENT.md</code> file.
            </p>
          </div>
        </div>
      )}

      <header className="App-header">
        <div className="header-content">
          <div className="header-info">
            <h1>Memory Server</h1>
            <p>Developer Memory Management</p>
          </div>
          
          <button 
            onClick={toggleTheme}
            className="theme-toggle"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        
        <nav className="main-nav">
          <button 
            className={`nav-button ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Home
          </button>
          <button
            className={`nav-button ${currentView === 'memories' ? 'active' : ''}`}
            onClick={() => setCurrentView('memories')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 12H15M9 16H15M17 21H7C6.46957 21 5.96086 20.7893 5.58579 20.4142C5.21071 20.0391 5 19.5304 5 19V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H12.586C12.8512 3.00006 13.1055 3.10545 13.293 3.293L18.707 8.707C18.8946 8.89449 18.9999 9.14881 19 9.414V19C19 19.5304 18.7893 20.0391 18.4142 20.4142C18.0391 20.7893 17.5304 21 17 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Memories
          </button>
          <button
            className={`nav-button ${currentView === 'temporary-memories' ? 'active' : ''}`}
            onClick={() => setCurrentView('temporary-memories')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Temporary
          </button>
          <button
            className={`nav-button ${currentView === 'tags' ? 'active' : ''}`}
            onClick={() => setCurrentView('tags')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20.59 13.41L13.42 20.58C13.2343 20.7656 13.0136 20.9135 12.7709 21.0141C12.5282 21.1148 12.2678 21.1666 12.005 21.1666C11.7422 21.1666 11.4818 21.1148 11.2391 21.0141C10.9964 20.9135 10.7757 20.7656 10.59 20.58L2 12V2H12L20.59 10.59C20.9625 10.9647 21.1716 11.4716 21.1716 12C21.1716 12.5284 20.9625 13.0353 20.59 13.41Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 7H7.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Tags
          </button>
          <button
            className={`nav-button ${currentView === 'api-keys' ? 'active' : ''}`}
            onClick={() => setCurrentView('api-keys')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 7C15 8.10457 14.1046 9 13 9C11.8954 9 11 8.10457 11 7C11 5.89543 11.8954 5 13 5C14.1046 5 15 5.89543 15 7Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M13 9V19M13 19L10 16M13 19L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            API Keys
          </button>
          <button
            className={`nav-button ${currentView === 'skill-download' ? 'active' : ''}`}
            onClick={() => setCurrentView('skill-download')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Skill
          </button>
          <button
            className={`nav-button ${currentView === 'mcp-apps' ? 'active' : ''}`}
            onClick={() => setCurrentView('mcp-apps')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            </svg>
            MCP Apps
          </button>
        </nav>
      </header>
      
      <main>
        {renderView()}
      </main>
    </div>
  );
}

export default App;