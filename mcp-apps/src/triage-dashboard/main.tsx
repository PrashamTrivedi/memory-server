import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { App } from '@modelcontextprotocol/ext-apps';
import '../shared/styles/base.css';

interface TempMemory {
  id: string;
  name: string;
  content: string;
  tags: string[];
  days_until_expiry: number;
  access_count: number;
  stage: 1 | 2;
  last_accessed: number;
  created_at: number;
}

interface MemoriesData {
  memories: TempMemory[];
  pagination?: {
    total: number;
  };
}

function parseToolResult<T>(result: unknown): T | null {
  if (!result || typeof result !== 'object') return null;
  const typedResult = result as { content?: Array<{ type: string; text?: string }> };
  const textContent = typedResult.content?.find((c) => c.type === 'text');
  if (!textContent?.text) return null;
  try {
    const data = JSON.parse(textContent.text);
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

function TriageDashboard() {
  const [app, setApp] = useState<App | null>(null);
  const [connected, setConnected] = useState(false);
  const [memories, setMemories] = useState<TempMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    const mcpApp = new App({ name: 'triage-dashboard', version: '1.0.0' });

    mcpApp.ontoolresult = (event) => {
      const data = parseToolResult<MemoriesData>(event.result);
      if (data?.memories) {
        setMemories(data.memories);
      }
      setLoading(false);
      setActionInProgress(null);
    };

    mcpApp.connect();
    setApp(mcpApp);
    setConnected(true);
  }, []);

  const refresh = async () => {
    if (!app) return;
    setLoading(true);
    await app.callServerTool({
      name: 'review_temporary_memories',
      arguments: { limit: 100 }
    });
  };

  const keepMemory = async (memory: TempMemory) => {
    if (!app) return;
    setActionInProgress(memory.id);
    await app.callServerTool({
      name: 'promote_memory',
      arguments: { id: memory.id }
    });
    await app.updateModelContext({
      content: [{ type: 'text', text: `Promoted memory to permanent: ${memory.name}` }]
    });
    await refresh();
  };

  const dropMemory = async (memory: TempMemory) => {
    if (!app) return;
    setActionInProgress(memory.id);
    await app.callServerTool({
      name: 'delete_memory',
      arguments: { id: memory.id }
    });
    await app.updateModelContext({
      content: [{ type: 'text', text: `Deleted temporary memory: ${memory.name}` }]
    });
    await refresh();
  };

  const promoteAllHealthy = async () => {
    if (!app) return;
    const healthy = memories.filter(m => m.days_until_expiry > 7);
    if (healthy.length === 0) return;

    setLoading(true);
    for (const memory of healthy) {
      await app.callServerTool({
        name: 'promote_memory',
        arguments: { id: memory.id }
      });
    }
    await app.updateModelContext({
      content: [{ type: 'text', text: `Promoted ${healthy.length} healthy memories to permanent` }]
    });
    await refresh();
  };

  const dropAllExpiring = async () => {
    if (!app) return;
    const expiring = memories.filter(m => m.days_until_expiry <= 7);
    if (expiring.length === 0) return;

    setLoading(true);
    for (const memory of expiring) {
      await app.callServerTool({
        name: 'delete_memory',
        arguments: { id: memory.id }
      });
    }
    await app.updateModelContext({
      content: [{ type: 'text', text: `Deleted ${expiring.length} expiring memories` }]
    });
    await refresh();
  };

  // Group memories
  const expiringSoon = memories.filter(m => m.days_until_expiry <= 7);
  const healthy = memories.filter(m => m.days_until_expiry > 7);

  const getUrgencyColor = (days: number) => {
    if (days <= 3) return 'bg-red-500';
    if (days <= 7) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getUrgencyLabel = (days: number) => {
    if (days <= 3) return 'URGENT';
    if (days <= 7) return 'Soon';
    return 'Safe';
  };

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Connecting...</div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Temporary Memories Triage</h1>

      {/* Batch Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={promoteAllHealthy}
          disabled={loading || healthy.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Promote All Healthy ({healthy.length})
        </button>
        <button
          onClick={dropAllExpiring}
          disabled={loading || expiringSoon.length === 0}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Drop All Expiring ({expiringSoon.length})
        </button>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <span className="self-center text-sm text-gray-500 ml-auto">
          {memories.length} temporary memories
        </span>
      </div>

      {/* Expiring Soon Section */}
      {expiringSoon.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-red-500 dark:text-red-400 mb-3 flex items-center gap-2">
            <span>⚠️</span> Expiring Soon ({expiringSoon.length})
          </h2>
          <div className="space-y-2">
            {expiringSoon.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                onKeep={() => keepMemory(memory)}
                onDrop={() => dropMemory(memory)}
                loading={actionInProgress === memory.id}
                getUrgencyColor={getUrgencyColor}
                getUrgencyLabel={getUrgencyLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* Healthy Section */}
      {healthy.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-green-500 dark:text-green-400 mb-3 flex items-center gap-2">
            <span>✓</span> Healthy ({healthy.length})
          </h2>
          <div className="space-y-2">
            {healthy.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                onKeep={() => keepMemory(memory)}
                onDrop={() => dropMemory(memory)}
                loading={actionInProgress === memory.id}
                getUrgencyColor={getUrgencyColor}
                getUrgencyLabel={getUrgencyLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {memories.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No temporary memories found.
          <br />
          Click Refresh to load temporary memories.
        </div>
      )}
    </div>
  );
}

interface MemoryRowProps {
  memory: TempMemory;
  onKeep: () => void;
  onDrop: () => void;
  loading: boolean;
  getUrgencyColor: (days: number) => string;
  getUrgencyLabel: (days: number) => string;
}

function MemoryRow({ memory, onKeep, onDrop, loading, getUrgencyColor, getUrgencyLabel }: MemoryRowProps) {
  const maxDays = memory.stage === 1 ? 14 : 28;
  const progress = Math.max(0, Math.min(100, (memory.days_until_expiry / maxDays) * 100));
  const accessTarget = memory.stage === 1 ? 5 : 15;

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{memory.name}</h3>
            <span className={`px-2 py-0.5 text-xs text-white rounded ${getUrgencyColor(memory.days_until_expiry)}`}>
              {getUrgencyLabel(memory.days_until_expiry)}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {memory.content.slice(0, 100)}
            {memory.content.length > 100 && '...'}
          </p>

          {/* Progress Bar */}
          <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
            <div
              className={`h-full transition-all ${getUrgencyColor(memory.days_until_expiry)}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stats */}
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex gap-4">
            <span>{memory.days_until_expiry} days left</span>
            <span>Stage {memory.stage}/2</span>
            <span>Accesses: {memory.access_count}/{accessTarget}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1">
          <button
            onClick={onKeep}
            disabled={loading}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '...' : 'Keep'}
          </button>
          <button
            onClick={onDrop}
            disabled={loading}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? '...' : 'Drop'}
          </button>
        </div>
      </div>
    </div>
  );
}

render(<TriageDashboard />, document.getElementById('app')!);
