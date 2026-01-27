import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { App } from '@modelcontextprotocol/ext-apps';
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

function MemoryBrowser() {
  const [app, setApp] = useState<App | null>(null);
  const [connected, setConnected] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const mcpApp = new App({ name: 'memory-browser', version: '1.0.0' });

    mcpApp.ontoolresult = (event) => {
      const data = parseToolResult<MemoriesData>(event.result);
      if (data?.memories) {
        setMemories(data.memories);
        setTotal(data.pagination?.total || data.memories.length);
      }
      setLoading(false);
    };

    mcpApp.connect();
    setApp(mcpApp);
    setConnected(true);
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
        <div className="text-gray-500">Connecting...</div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Memory Browser</h1>

      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search memories..."
          className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={search}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {/* Bulk Actions */}
      {memories.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === memories.length && memories.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Select All ({memories.length})
            </span>
          </label>
          {selected.size > 0 && (
            <button
              onClick={bulkDelete}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete Selected ({selected.size})
            </button>
          )}
          <span className="text-sm text-gray-500 ml-auto">
            {total} total memories
          </span>
        </div>
      )}

      {/* Memory List */}
      {loading && memories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : memories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No memories found. Click Search to load memories or try a different query.
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className={`p-4 border rounded flex gap-3 transition-colors ${
                selected.has(memory.id)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(memory.id)}
                onChange={() => toggleSelect(memory.id)}
                className="mt-1 w-4 h-4 rounded"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{memory.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate-2 mt-1">
                  {memory.content.slice(0, 150)}
                  {memory.content.length > 150 && '...'}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {memory.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-xs text-gray-400 ml-auto">
                    {formatDate(memory.updated_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteMemory(memory.id, memory.name)}
                className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded self-start"
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
