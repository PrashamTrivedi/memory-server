import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { generateMcpConfig, getServerUrl, redactApiKey } from '../utils/mcpConfig';
import './ApiKeys.css';

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
      <div className="loading-state">
        <div className="spinner"></div>
        <span style={{ marginLeft: '1rem' }}>Loading API keys...</span>
      </div>
    );
  }

  return (
    <div className="api-keys-page">
      <div className="api-keys-header">
        <div className="api-keys-header-top">
          <h1>API Key Management</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="create-key-btn"
          >
            {showCreateForm ? '✕ Cancel' : '+ Create New Key'}
          </button>
        </div>

        <div className="api-keys-stats">
          <div className="api-key-stat">
            <span className="api-key-stat-value">{keys.length}</span>
            <span className="api-key-stat-label">Total Keys</span>
          </div>
          <div className="api-key-stat">
            <span className="api-key-stat-value">{keys.filter(k => k.is_active).length}</span>
            <span className="api-key-stat-label">Active Keys</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="api-keys-error">
          {error}
        </div>
      )}

      {/* Newly created key warning */}
      {newlyCreatedKey && (
        <div className="new-key-alert">
          <h2 className="new-key-alert-title">
            ⚠️ Save This API Key Now!
          </h2>
          <p className="new-key-alert-subtitle">
            This is the only time you'll see this key. Store it securely.
          </p>

          <div className="new-key-display">
            <div className="new-key-value">
              <span className="new-key-text">{newlyCreatedKey.key}</span>
              <button
                onClick={() => copyToClipboard(newlyCreatedKey.key, 'API key copied to clipboard!')}
                className="copy-key-btn"
              >
                📋 Copy
              </button>
            </div>
          </div>

          <div className="new-key-details">
            <p><strong>Entity:</strong> {newlyCreatedKey.entity_name}</p>
            <p><strong>Created:</strong> {formatDate(newlyCreatedKey.created_at)}</p>
            {newlyCreatedKey.expires_at && (
              <p><strong>Expires:</strong> {formatDate(newlyCreatedKey.expires_at)}</p>
            )}
          </div>

          <div className="mcp-config-section">
            <div className="mcp-config-header">
              <h3>MCP Configuration</h3>
              <button
                onClick={() => {
                  const config = generateMcpConfig(getServerUrl(), newlyCreatedKey.key);
                  copyToClipboard(JSON.stringify(config, null, 2), 'MCP configuration copied!');
                }}
                className="copy-config-btn"
              >
                Copy Full Config
              </button>
            </div>
            <pre className="mcp-config-code">
              {JSON.stringify(
                generateMcpConfig(getServerUrl(), redactApiKey(newlyCreatedKey.key)),
                null,
                2
              )}
            </pre>
            <p className="mcp-config-note">
              <strong>Note:</strong> The API key shown above is redacted. Click "Copy Full Config"
              to copy the complete configuration with your actual API key.
            </p>
          </div>

          <button
            onClick={() => setNewlyCreatedKey(null)}
            className="dismiss-key-btn"
          >
            ✓ I've Saved This Key
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="create-key-form">
          <h2>Create New API Key</h2>
          <form onSubmit={createKey}>
            <div className="form-group">
              <label className="form-label">
                Entity Name <span className="form-label-required">*</span>
              </label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="e.g., Claude Desktop - Laptop"
                className="form-input"
                required
              />
              <p className="form-hint">
                A descriptive name to identify this key
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this key..."
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Expires In (days)
              </label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
                placeholder="Leave empty for no expiration"
                className="form-input"
                min="1"
              />
              <p className="form-hint">
                Leave empty for keys that never expire
              </p>
            </div>

            <button type="submit" className="submit-btn">
              ✓ Create API Key
            </button>
          </form>
        </div>
      )}

      {/* Keys table */}
      <div className="keys-table-container">
        <table className="keys-table">
          <thead>
            <tr>
              <th>Entity Name</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  No API keys found. Create one to get started.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className={key.is_active ? '' : 'revoked'}>
                  <td>
                    <div className="key-entity-name">{key.entity_name}</div>
                    {key.notes && (
                      <div className="key-notes">{key.notes}</div>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${key.is_active ? 'active' : 'revoked'}`}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td>{formatDate(key.created_at)}</td>
                  <td>{formatDate(key.last_used_at)}</td>
                  <td>{key.expires_at ? formatDate(key.expires_at) : 'Never'}</td>
                  <td>
                    {key.is_active ? (
                      <button
                        onClick={() => revokeKey(key.id, key.entity_name)}
                        className="revoke-btn"
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="revoke-btn disabled">Revoked</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="toast">
          ✓ {toastMessage}
        </div>
      )}
    </div>
  );
}
