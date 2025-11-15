import { useState, useEffect } from 'react';
import { api } from '../api/client';

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
      const response = await api.get<{ keys: ApiKey[]; total: number }>('/api/admin/keys');
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
      const response = await api.post<NewApiKey>('/api/admin/keys', {
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
      await api.delete(`/api/admin/keys/${id}`);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return <div className="p-4">Loading API keys...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">API Key Management</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create New Key'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Newly created key warning */}
      {newlyCreatedKey && (
        <div className="mb-6 p-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">
            ⚠️ Save This API Key Now!
          </h2>
          <p className="text-sm text-yellow-700 mb-4">
            This is the only time you'll see this key. Store it securely.
          </p>

          <div className="bg-white p-4 rounded border border-yellow-300 font-mono text-sm mb-4">
            <div className="flex justify-between items-center">
              <span className="break-all">{newlyCreatedKey.key}</span>
              <button
                onClick={() => copyToClipboard(newlyCreatedKey.key)}
                className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-700">
            <p><strong>Entity:</strong> {newlyCreatedKey.entity_name}</p>
            <p><strong>Created:</strong> {formatDate(newlyCreatedKey.created_at)}</p>
            {newlyCreatedKey.expires_at && (
              <p><strong>Expires:</strong> {formatDate(newlyCreatedKey.expires_at)}</p>
            )}
          </div>

          <button
            onClick={() => setNewlyCreatedKey(null)}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            I've Saved This Key
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-300 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Create New API Key</h2>
          <form onSubmit={createKey} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Entity Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="e.g., Claude Desktop - Laptop"
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                A descriptive name to identify this key
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this key..."
                className="w-full px-3 py-2 border border-gray-300 rounded"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Expires In (days)
              </label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
                placeholder="Leave empty for no expiration"
                className="w-full px-3 py-2 border border-gray-300 rounded"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for keys that never expire
              </p>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create API Key
            </button>
          </form>
        </div>
      )}

      {/* Keys table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entity Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No API keys found. Create one to get started.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className={key.is_active ? '' : 'bg-gray-50 opacity-60'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{key.entity_name}</div>
                    {key.notes && (
                      <div className="text-xs text-gray-500">{key.notes}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {key.is_active ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Revoked
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(key.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(key.last_used_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {key.expires_at ? formatDate(key.expires_at) : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {key.is_active ? (
                      <button
                        onClick={() => revokeKey(key.id, key.entity_name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="text-gray-400">Revoked</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Total keys:</strong> {keys.length}</p>
        <p><strong>Active keys:</strong> {keys.filter(k => k.is_active).length}</p>
      </div>
    </div>
  );
}
