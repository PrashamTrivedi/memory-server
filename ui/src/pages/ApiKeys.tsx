import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { generateMcpConfig, getServerUrl, redactApiKey } from '../utils/mcpConfig';

interface ApiKey {
  id: string;
  entity_name: string;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
  is_active: number;
  notes: string | null;
}

interface NewApiKey {
  id: string;
  key: string;
  entity_name: string;
  created_at: number;
  expires_at: number | null;
  notes: string | null;
}

export function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewApiKey | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Form state
  const [entityName, setEntityName] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ keys: ApiKey[]; total: number }>('/admin/keys');
      setKeys(response.data?.keys || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!entityName.trim()) {
      setError('Entity name is required');
      return;
    }

    try {
      const response = await api.post<NewApiKey>('/admin/keys', {
        entity_name: entityName,
        notes: notes || undefined,
        expires_in_days: expiresInDays || undefined
      });

      if (response.data) {
        setNewlyCreatedKey(response.data);
      }
      setEntityName('');
      setNotes('');
      setExpiresInDays('');
      setShowCreateForm(false);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    }
  };

  const revokeKey = async (id: string, entityName: string) => {
    if (!confirm(`Are you sure you want to revoke the API key for "${entityName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/admin/keys/${id}`);
      await loadKeys();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const copyToClipboard = (text: string, message = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text);
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 dark:text-slate-400">
        <svg className="animate-spin h-5 w-5 mr-3 text-primary-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium">Loading API keys...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1
            className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            API Key Management
          </h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-primary-500 text-white hover:bg-primary-600 rounded-xl font-semibold px-5 py-2.5 text-sm transition-colors cursor-pointer"
          >
            {showCreateForm ? 'Cancel' : '+ Create New Key'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 text-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 block mb-1">
              {keys.length}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Keys
            </span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 text-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 block mb-1">
              {keys.filter(k => k.is_active).length}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Keys
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-5 py-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium animate-fade-in">
          {error}
        </div>
      )}

      {/* Newly created key warning */}
      {newlyCreatedKey && (
        <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-400 dark:border-amber-600 rounded-xl animate-fade-in">
          <h2
            className="text-xl font-extrabold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-2"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Save This API Key Now
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            This is the only time you'll see this key. Store it securely.
          </p>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <span className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all flex-1 min-w-0">
                {newlyCreatedKey.key}
              </span>
              <button
                onClick={() => copyToClipboard(newlyCreatedKey.key, 'API key copied to clipboard!')}
                className="bg-primary-500 text-white hover:bg-primary-600 rounded-xl font-semibold px-4 py-2 text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                Copy Key
              </button>
            </div>
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-5">
            <p><span className="font-semibold text-slate-900 dark:text-slate-200">Entity:</span> {newlyCreatedKey.entity_name}</p>
            <p><span className="font-semibold text-slate-900 dark:text-slate-200">Created:</span> {formatDate(newlyCreatedKey.created_at)}</p>
            {newlyCreatedKey.expires_at && (
              <p><span className="font-semibold text-slate-900 dark:text-slate-200">Expires:</span> {formatDate(newlyCreatedKey.expires_at)}</p>
            )}
          </div>

          {/* MCP Config */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-5">
            <div className="flex justify-between items-center mb-3">
              <h3
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              >
                MCP Configuration
              </h3>
              <button
                onClick={() => {
                  const config = generateMcpConfig(getServerUrl(), newlyCreatedKey.key);
                  copyToClipboard(JSON.stringify(config, null, 2), 'MCP configuration copied!');
                }}
                className="bg-primary-500 text-white hover:bg-primary-600 rounded-xl font-semibold px-3 py-1.5 text-xs transition-colors cursor-pointer"
              >
                Copy Full Config
              </button>
            </div>
            <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre text-slate-800 dark:text-slate-200 leading-relaxed">
              {JSON.stringify(
                generateMcpConfig(getServerUrl(), redactApiKey(newlyCreatedKey.key)),
                null,
                2
              )}
            </pre>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-primary-50 dark:bg-primary-900/10 rounded-lg p-2.5 border-l-3 border-primary-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Note:</span> The API key shown above is redacted. Click "Copy Full Config"
              to copy the complete configuration with your actual API key.
            </p>
          </div>

          <button
            onClick={() => setNewlyCreatedKey(null)}
            className="bg-amber-500 text-white hover:bg-amber-600 rounded-xl font-semibold px-5 py-2.5 text-sm transition-colors cursor-pointer"
          >
            I've Saved This Key
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="mb-8 p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl animate-fade-in">
          <h2
            className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-5"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            Create New API Key
          </h2>
          <form onSubmit={createKey}>
            <div className="mb-5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
                Entity Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="e.g., Claude Desktop - Laptop"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                required
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                A descriptive name to identify this key
              </p>
            </div>

            <div className="mb-5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this key..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-y min-h-[80px]"
                rows={3}
              />
            </div>

            <div className="mb-6">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
                Expires In (days)
              </label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
                placeholder="Leave empty for no expiration"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                min="1"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Leave empty for keys that never expire
              </p>
            </div>

            <button
              type="submit"
              className="bg-primary-500 text-white hover:bg-primary-600 rounded-xl font-semibold px-6 py-2.5 text-sm transition-colors cursor-pointer"
            >
              Create API Key
            </button>
          </form>
        </div>
      )}

      {/* Keys table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Entity Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Last Used</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Expires</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                    No API keys found. Create one to get started.
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr
                    key={key.id}
                    className={`border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                      key.is_active ? '' : 'opacity-50'
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {key.entity_name}
                      </div>
                      {key.notes && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {key.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {key.is_active ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(key.created_at)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(key.last_used_at)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {key.expires_at ? formatDate(key.expires_at) : 'Never'}
                    </td>
                    <td className="px-5 py-4">
                      {key.is_active ? (
                        <button
                          onClick={() => revokeKey(key.id, key.entity_name)}
                          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-sm font-medium px-3 py-1">
                          Revoked
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 animate-float-up">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
