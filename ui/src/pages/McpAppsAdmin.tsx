import { useState, useEffect, useRef, useCallback } from 'react';
import { listMcpApps, uploadMcpApp, deleteMcpApp, McpAppInfo } from '../api/mcpApps';

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
      <div className="flex items-center justify-center py-20 text-slate-500">
        <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        <span className="ml-4 text-sm font-medium">Loading MCP apps...</span>
      </div>
    );
  }

  const deployedCount = apps.filter(a => a.deployed).length;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="mb-10">
        <h1
          className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-6"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          MCP Apps Management
        </h1>

        {/* Stats row */}
        <div className="flex gap-8">
          <div className="text-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 block">
              {apps.length}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Apps
            </span>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 block">
              {deployedCount}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Deployed
            </span>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 block">
              {apps.length - deployedCount}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Not Deployed
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-5 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      {/* App Cards Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 mb-8">
        {apps.map((app) => (
          <div
            key={app.name}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col transition-shadow hover:shadow-md"
          >
            {/* Accent bar */}
            <div
              className={app.deployed ? 'bg-green-500' : 'bg-amber-500'}
              style={{ height: '3px' }}
            />

            {/* Card header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {app.name}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  app.deployed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}
              >
                {app.deployed ? 'Deployed' : 'Not Deployed'}
              </span>
            </div>

            {/* Card body */}
            <div className="px-5 py-4 flex-1">
              {app.deployed ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Size</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatSize(app.size)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Updated</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatDate(app.updatedAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-3">
                  No bundle deployed
                </p>
              )}
            </div>

            {/* Card actions */}
            <div className="px-5 py-3 flex gap-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <button
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white hover:bg-primary-600 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => handleFileSelect(app.name)}
                disabled={uploading === app.name}
              >
                {uploading === app.name ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
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
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-semibold transition-colors"
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

      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          isDragging
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10'
            : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          className={`mx-auto mb-3 transition-colors ${
            isDragging ? 'text-primary-500' : 'text-slate-400'
          }`}
        >
          <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 3V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Drop HTML files here to upload
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Files will be matched to apps by name
        </p>
      </div>

      {/* Toast */}
      {showToast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 text-white ${
            toastType === 'success' ? 'bg-slate-900' : 'bg-red-600'
          }`}
        >
          {toastType === 'success' ? '\u2713' : '\u2715'} {toastMessage}
        </div>
      )}
    </div>
  );
}
