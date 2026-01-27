import { useState, useEffect, useRef, useCallback } from 'react';
import { listMcpApps, uploadMcpApp, deleteMcpApp, McpAppInfo } from '../api/mcpApps';
import './McpAppsAdmin.css';

export function McpAppsAdmin() {
  const [apps, setApps] = useState<McpAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [uploading, setUploading] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setLoading(true);
      const data = await listMcpApps();
      setApps(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP apps');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleUpload = async (appName: string, file: File) => {
    if (!file.name.endsWith('.html')) {
      showNotification('Please select an HTML file', 'error');
      return;
    }

    try {
      setUploading(appName);
      const content = await file.text();
      await uploadMcpApp(appName, content);
      showNotification(`${appName} uploaded successfully`);
      await loadApps();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (appName: string) => {
    if (!confirm(`Are you sure you want to delete ${appName}? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteMcpApp(appName);
      showNotification(`${appName} deleted successfully`);
      await loadApps();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleFileSelect = (appName: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleUpload(appName, file);
      }
    };
    input.click();
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.html')) {
      showNotification('Please drop an HTML file', 'error');
      return;
    }

    // Try to match filename to app name
    const fileName = file.name.replace('.html', '').replace('index', '').replace(/^-+|-+$/g, '');
    const matchedApp = apps.find(app =>
      file.name.includes(app.name) ||
      app.name.includes(fileName) ||
      file.name.toLowerCase().includes(app.name.split('-')[0])
    );

    if (matchedApp) {
      handleUpload(matchedApp.name, file);
    } else {
      // Show app selector modal or default to first app
      const appName = prompt(
        `Which app should this file be uploaded to?\n\nOptions:\n${apps.map(a => `- ${a.name}`).join('\n')}`,
        apps[0]?.name
      );
      if (appName && apps.some(a => a.name === appName)) {
        handleUpload(appName, file);
      } else if (appName) {
        showNotification('Invalid app name', 'error');
      }
    }
  }, [apps]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <span style={{ marginLeft: '1rem' }}>Loading MCP apps...</span>
      </div>
    );
  }

  const deployedCount = apps.filter(a => a.deployed).length;

  return (
    <div className="mcp-apps-page">
      <div className="mcp-apps-header">
        <div className="mcp-apps-header-top">
          <h1>MCP Apps Management</h1>
        </div>

        <div className="mcp-apps-stats">
          <div className="mcp-app-stat">
            <span className="mcp-app-stat-value">{apps.length}</span>
            <span className="mcp-app-stat-label">Total Apps</span>
          </div>
          <div className="mcp-app-stat">
            <span className="mcp-app-stat-value">{deployedCount}</span>
            <span className="mcp-app-stat-label">Deployed</span>
          </div>
          <div className="mcp-app-stat">
            <span className="mcp-app-stat-value">{apps.length - deployedCount}</span>
            <span className="mcp-app-stat-label">Not Deployed</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mcp-apps-error">
          {error}
        </div>
      )}

      <div className="app-cards-grid">
        {apps.map((app) => (
          <div key={app.name} className={`app-card ${app.deployed ? 'deployed' : 'not-deployed'}`}>
            <div className="app-card-header">
              <h3 className="app-card-name">{app.name}</h3>
              <span className={`app-status-badge ${app.deployed ? 'deployed' : 'not-deployed'}`}>
                {app.deployed ? 'Deployed' : 'Not Deployed'}
              </span>
            </div>

            <div className="app-card-body">
              {app.deployed ? (
                <>
                  <div className="app-card-info">
                    <div className="app-info-row">
                      <span className="app-info-label">Size</span>
                      <span className="app-info-value">{formatSize(app.size)}</span>
                    </div>
                    <div className="app-info-row">
                      <span className="app-info-label">Updated</span>
                      <span className="app-info-value">{formatDate(app.updatedAt)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="app-card-empty">No bundle deployed</p>
              )}
            </div>

            <div className="app-card-actions">
              <button
                className="app-action-btn upload"
                onClick={() => handleFileSelect(app.name)}
                disabled={uploading === app.name}
              >
                {uploading === app.name ? (
                  <>
                    <span className="spinner-small"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Upload
                  </>
                )}
              </button>
              {app.deployed && (
                <button
                  className="app-action-btn delete"
                  onClick={() => handleDelete(app.name)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        ref={dropZoneRef}
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="drop-zone-icon">
          <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 3V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="drop-zone-text">Drop HTML files here to upload</p>
        <p className="drop-zone-hint">Files will be matched to apps by name</p>
      </div>

      {showToast && (
        <div className={`toast ${toastType}`}>
          {toastType === 'success' ? '✓' : '✕'} {toastMessage}
        </div>
      )}
    </div>
  );
}
