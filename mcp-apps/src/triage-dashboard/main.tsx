import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from '@modelcontextprotocol/ext-apps';
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

function parseToolResult<T>(params: unknown): T | null {
  if (!params || typeof params !== 'object') return null;

  const typedParams = params as {
    content?: Array<{ type: string; text?: string; mimeType?: string }>;
    result?: { content?: Array<{ type: string; text?: string; mimeType?: string }> };
    isError?: boolean;
  };

  if (typedParams.isError) return null;

  const content = typedParams.content || typedParams.result?.content;
  if (!content) return null;

  // Claude.ai strips mimeType, so find JSON by content pattern
  for (const item of content) {
    if (item.type !== 'text' || !item.text) continue;
    const text = item.text.trim();
    if (!text.startsWith('{') && !text.startsWith('[')) continue;
    try {
      const data = JSON.parse(text);
      return data.success ? data.data : data;
    } catch {
      continue;
    }
  }
  return null;
}

function TriageDashboard() {
  const [app, setApp] = useState<App | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [memories, setMemories] = useState<TempMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    const mcpApp = new App({ name: 'triage-dashboard', version: '1.0.0' });

    // Register ALL handlers BEFORE connect()

    // Handle tool input (when tool execution begins)
    mcpApp.ontoolinput = (params) => {
      console.log('[triage-dashboard] ontoolinput:', params);
      setLoading(true);
    };

    // Handle tool result (when tool execution completes)
    mcpApp.ontoolresult = (params) => {
      console.log('[triage-dashboard] ontoolresult:', params);
      const data = parseToolResult<MemoriesData>(params);
      if (data?.memories) {
        setMemories(data.memories);
      }
      setLoading(false);
      setActionInProgress(null);
    };

    // Handle host context changes (theme, styling)
    mcpApp.onhostcontextchanged = (ctx) => {
      console.log('[triage-dashboard] onhostcontextchanged:', ctx);
      if (ctx.theme) applyDocumentTheme(ctx.theme);
      if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
      if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
      if (ctx.safeAreaInsets) {
        const { top, right, bottom, left } = ctx.safeAreaInsets;
        document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      }
    };

    // Handle teardown
    mcpApp.onteardown = async () => {
      console.log('[triage-dashboard] onteardown');
      return {};
    };

    // Now connect
    (async () => {
      try {
        await mcpApp.connect();
        setApp(mcpApp);
        setConnected(true);
        setConnectionError(null);
        console.log('[triage-dashboard] Connected successfully');
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[triage-dashboard] Connection failed:', errMsg);
        setConnectionError(errMsg);
      }
    })();
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
        <div className="text-center p-4">
          {connectionError ? (
            <>
              <div className="text-red-500 font-medium mb-2">Connection Failed</div>
              <div className="text-claude-text-secondary dark:text-claude-dark-text-secondary text-sm">
                {connectionError}
              </div>
              <div className="text-claude-text-secondary dark:text-claude-dark-text-secondary text-xs mt-4">
                MCP Apps require a host that supports the MCP Apps extension.
              </div>
            </>
          ) : (
            <div className="text-claude-text-secondary dark:text-claude-dark-text-secondary">Connecting...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-claude-text dark:text-claude-dark-text mb-6">Temporary Memories Triage</h1>

      {/* Batch Actions */}
      <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-claude-border dark:border-claude-dark-border">
        <button
          onClick={promoteAllHealthy}
          disabled={loading || healthy.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-claude font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Promote All Healthy ({healthy.length})
        </button>
        <button
          onClick={dropAllExpiring}
          disabled={loading || expiringSoon.length === 0}
          className="px-4 py-2 bg-red-500 text-white rounded-claude font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          Drop All Expiring ({expiringSoon.length})
        </button>
        <button
          onClick={refresh}
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <span className="self-center text-sm text-claude-text-secondary dark:text-claude-dark-text-secondary ml-auto">
          {memories.length} temporary memories
        </span>
      </div>

      {/* Expiring Soon Section */}
      {expiringSoon.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
            Expiring Soon ({expiringSoon.length})
          </h2>
          <div className="space-y-3">
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
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-4 flex items-center gap-2">
            Healthy ({healthy.length})
          </h2>
          <div className="space-y-3">
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
        <div className="text-center py-12 text-claude-text-secondary dark:text-claude-dark-text-secondary">
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

  const urgencyBadgeClass = memory.days_until_expiry <= 3
    ? 'badge-danger'
    : memory.days_until_expiry <= 7
    ? 'badge-warning'
    : 'badge-success';

  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-claude-text dark:text-claude-dark-text truncate">{memory.name}</h3>
            <span className={`badge ${urgencyBadgeClass}`}>
              {getUrgencyLabel(memory.days_until_expiry)}
            </span>
          </div>
          <p className="text-sm text-claude-text-secondary dark:text-claude-dark-text-secondary truncate">
            {memory.content.slice(0, 100)}
            {memory.content.length > 100 && '...'}
          </p>

          {/* Progress Bar */}
          <div className="mt-3 h-1.5 bg-claude-border dark:bg-claude-dark-border rounded-full overflow-hidden">
            <div
              className={`h-full transition-all rounded-full ${getUrgencyColor(memory.days_until_expiry)}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stats */}
          <div className="mt-2 text-xs text-claude-text-secondary dark:text-claude-dark-text-secondary flex gap-4">
            <span>{memory.days_until_expiry} days left</span>
            <span>Stage {memory.stage}/2</span>
            <span>Accesses: {memory.access_count}/{accessTarget}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onKeep}
            disabled={loading}
            className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-claude font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : 'Keep'}
          </button>
          <button
            onClick={onDrop}
            disabled={loading}
            className="btn-danger"
          >
            {loading ? '...' : 'Drop'}
          </button>
        </div>
      </div>
    </div>
  );
}

render(<TriageDashboard />, document.getElementById('app')!);
