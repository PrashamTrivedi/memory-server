import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from '@modelcontextprotocol/ext-apps';
import '../shared/styles/base.css';

interface Memory {
  id: string;
  name: string;
  content: string;
  tags: string[];
  url?: string;
  updated_at: number;
}

interface MemoriesData {
  memories: Memory[];
  pagination?: {
    total: number;
    has_more: boolean;
  };
}

function parseToolResult<T>(params: unknown): T | null {
  if (!params || typeof params !== 'object') return null;

  const typedParams = params as {
    content?: Array<{ type: string; text?: string; mimeType?: string }>;
    result?: { content?: Array<{ type: string; text?: string; mimeType?: string }> };
    isError?: boolean;
  };

  if (typedParams.isError) {
    console.error('[parseToolResult] Tool returned error');
    return null;
  }

  const content = typedParams.content || typedParams.result?.content;
  if (!content) {
    console.error('[parseToolResult] No content found');
    return null;
  }

  // Claude.ai strips mimeType, so we need to find JSON by content pattern
  // Try each text content and return first successful JSON parse
  for (const item of content) {
    if (item.type !== 'text' || !item.text) continue;

    const text = item.text.trim();
    // Skip if it doesn't look like JSON (starts with { or [)
    if (!text.startsWith('{') && !text.startsWith('[')) continue;

    try {
      const data = JSON.parse(text);
      console.log('[parseToolResult] Successfully parsed JSON');
      return data.success ? data.data : data;
    } catch {
      // Not valid JSON, continue to next item
      continue;
    }
  }

  console.error('[parseToolResult] No valid JSON content found');
  return null;
}

function MemoryBrowser() {
  const [app, setApp] = useState<App | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    const mcpApp = new App({ name: 'memory-browser', version: '1.0.0' });

    // Register ALL handlers BEFORE connect()

    // Handle tool input (when tool execution begins)
    mcpApp.ontoolinput = (params) => {
      console.log('[memory-browser] ontoolinput:', params);
      setLoading(true);
      // If query was provided in tool args, use it
      if (params.arguments?.query) {
        setQuery(params.arguments.query as string);
      }
    };

    // Handle tool result (when tool execution completes)
    mcpApp.ontoolresult = (params) => {
      console.log('[memory-browser] ========== ONTOOLRESULT ==========');
      console.log('[memory-browser] Raw params:', params);
      console.log('[memory-browser] params type:', typeof params);
      console.log('[memory-browser] params keys:', params ? Object.keys(params) : 'null');
      console.log('[memory-browser] params.content:', params?.content);
      console.log('[memory-browser] params.result:', params?.result);
      console.log('[memory-browser] params.isError:', params?.isError);

      // Try to find content in various places
      const p = params as any;
      const content = p?.content || p?.result?.content || p?.result;
      console.log('[memory-browser] Extracted content:', content);

      if (Array.isArray(content)) {
        content.forEach((item: any, i: number) => {
          console.log(`[memory-browser] content[${i}]:`, {
            type: item.type,
            mimeType: item.mimeType,
            textPreview: item.text?.substring(0, 200)
          });
        });
      }

      const data = parseToolResult<MemoriesData>(params);
      console.log('[memory-browser] Parsed data:', data);

      if (data?.memories) {
        console.log('[memory-browser] SUCCESS - Setting memories:', data.memories.length);
        setMemories(data.memories);
        setTotal(data.pagination?.total || data.memories.length);
        setInitialLoad(false);
      } else {
        console.warn('[memory-browser] FAIL - No memories in parsed data');
      }
      setLoading(false);
    };

    // Handle host context changes (theme, styling)
    mcpApp.onhostcontextchanged = (ctx) => {
      console.log('[memory-browser] onhostcontextchanged:', ctx);
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
      console.log('[memory-browser] onteardown');
      return {};
    };

    // Now connect
    (async () => {
      try {
        await mcpApp.connect();
        setApp(mcpApp);
        setConnected(true);
        setConnectionError(null);
        console.log('[memory-browser] Connected successfully');
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[memory-browser] Connection failed:', errMsg);
        setConnectionError(errMsg);
      }
    })();
  }, []);

  const search = async () => {
    if (!app) return;
    setLoading(true);
    await app.callServerTool({
      name: query ? 'find_memories' : 'list_memories',
      arguments: query ? { query, limit: 50 } : { limit: 50 }
    });
  };

  const deleteMemory = async (id: string, name: string) => {
    if (!app) return;
    setLoading(true);
    await app.callServerTool({ name: 'delete_memory', arguments: { id } });
    await app.updateModelContext({
      content: [{ type: 'text', text: `Deleted memory: ${name}` }]
    });
    await search();
  };

  const bulkDelete = async () => {
    if (!app || selected.size === 0) return;
    setLoading(true);
    const names: string[] = [];
    for (const id of selected) {
      const memory = memories.find(m => m.id === id);
      if (memory) names.push(memory.name);
      await app.callServerTool({ name: 'delete_memory', arguments: { id } });
    }
    await app.updateModelContext({
      content: [{ type: 'text', text: `Deleted ${selected.size} memories: ${names.join(', ')}` }]
    });
    setSelected(new Set());
    await search();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === memories.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(memories.map(m => m.id)));
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
      <h1 className="text-2xl font-semibold text-claude-text dark:text-claude-dark-text mb-6">Memory Browser</h1>

      {/* Search Bar */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search memories..."
          className="input-field flex-1"
        />
        <button
          onClick={search}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Bulk Actions */}
      {memories.length > 0 && (
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-claude-border dark:border-claude-dark-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === memories.length && memories.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded border-claude-border accent-claude-coral"
            />
            <span className="text-sm text-claude-text-secondary dark:text-claude-dark-text-secondary">
              Select All ({memories.length})
            </span>
          </label>
          {selected.size > 0 && (
            <button
              onClick={bulkDelete}
              className="btn-danger"
            >
              Delete Selected ({selected.size})
            </button>
          )}
          <span className="text-sm text-claude-text-secondary dark:text-claude-dark-text-secondary ml-auto">
            {total} total memories
          </span>
        </div>
      )}

      {/* Memory List */}
      {loading && memories.length === 0 ? (
        <div className="text-center py-12 text-claude-text-secondary dark:text-claude-dark-text-secondary">
          Loading memories...
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-claude-text-secondary dark:text-claude-dark-text-secondary">
            {initialLoad ? 'Waiting for tool result...' : 'No memories found. Click Search to load memories.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className={`card p-4 flex gap-4 transition-all ${
                selected.has(memory.id)
                  ? 'ring-2 ring-claude-coral bg-claude-coral-light dark:bg-claude-coral/10'
                  : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(memory.id)}
                onChange={() => toggleSelect(memory.id)}
                className="mt-1 w-4 h-4 rounded border-claude-border accent-claude-coral"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-claude-text dark:text-claude-dark-text truncate">
                  {memory.name}
                </h3>
                <p className="text-sm text-claude-text-secondary dark:text-claude-dark-text-secondary truncate-2 mt-1">
                  {memory.content.slice(0, 150)}
                  {memory.content.length > 150 && '...'}
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {memory.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                  <span className="text-xs text-claude-text-secondary dark:text-claude-dark-text-secondary ml-auto">
                    {formatDate(memory.updated_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteMemory(memory.id, memory.name)}
                className="btn-danger self-start"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

render(<MemoryBrowser />, document.getElementById('app')!);
