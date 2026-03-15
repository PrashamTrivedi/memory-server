import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from '@modelcontextprotocol/ext-apps';
import '../shared/styles/base.css';

interface Tag {
  id: number;
  name: string;
  parent_id: number | null;
  memory_count: number;
}

interface TagTreeNode extends Tag {
  children: TagTreeNode[];
}

interface Memory {
  id: string;
  name: string;
  content: string;
  tags: string[];
}

interface TagsData {
  tags: Tag[];
}

interface MemoriesData {
  memories: Memory[];
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

function buildTree(tags: Tag[]): TagTreeNode[] {
  const map = new Map<number, TagTreeNode>();
  const roots: TagTreeNode[] = [];

  // Initialize all nodes
  for (const tag of tags) {
    map.set(tag.id, { ...tag, children: [] });
  }

  // Build tree
  for (const tag of tags) {
    const node = map.get(tag.id)!;
    if (tag.parent_id && map.has(tag.parent_id)) {
      map.get(tag.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort by name
  const sortNodes = (nodes: TagTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

function TagManager() {
  const [app, setApp] = useState<App | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tree, setTree] = useState<TagTreeNode[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    const mcpApp = new App({ name: 'tag-manager', version: '1.0.0' });

    // Register ALL handlers BEFORE connect()

    // Handle tool input (when tool execution begins)
    mcpApp.ontoolinput = (params) => {
      console.log('[tag-manager] ontoolinput:', params);
      setLoading(true);
    };

    // Handle tool result (when tool execution completes)
    mcpApp.ontoolresult = (params) => {
      console.log('[tag-manager] ontoolresult:', params);
      const tagsData = parseToolResult<TagsData>(params);
      if (tagsData?.tags) {
        setTags(tagsData.tags);
        setTree(buildTree(tagsData.tags));
      }

      const memoriesData = parseToolResult<MemoriesData>(params);
      if (memoriesData?.memories) {
        setMemories(memoriesData.memories);
      }

      setLoading(false);
    };

    // Handle host context changes (theme, styling)
    mcpApp.onhostcontextchanged = (ctx) => {
      console.log('[tag-manager] onhostcontextchanged:', ctx);
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
      console.log('[tag-manager] onteardown');
      return {};
    };

    // Now connect
    (async () => {
      try {
        await mcpApp.connect();
        setApp(mcpApp);
        setConnected(true);
        setConnectionError(null);
        console.log('[tag-manager] Connected successfully');
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[tag-manager] Connection failed:', errMsg);
        setConnectionError(errMsg);
      }
    })();
  }, []);

  const loadTags = async () => {
    if (!app) return;
    setLoading(true);
    await app.callServerTool({ name: 'list_tags', arguments: {} });
  };

  const selectTag = async (tag: Tag) => {
    if (!app) return;
    setSelectedTag(tag);
    setLoading(true);
    await app.callServerTool({
      name: 'find_memories',
      arguments: { tags: [tag.name], limit: 50 }
    });
  };

  const startRename = (tag: Tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
  };

  const saveRename = async () => {
    if (!app || editingTag === null || !editName.trim()) return;
    setLoading(true);
    await app.callServerTool({
      name: 'rename_tag',
      arguments: { tagId: editingTag, newName: editName.trim() }
    });
    await app.updateModelContext({
      content: [{ type: 'text', text: `Renamed tag to: ${editName.trim()}` }]
    });
    setEditingTag(null);
    setEditName('');
    await loadTags();
  };

  const cancelRename = () => {
    setEditingTag(null);
    setEditName('');
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-claude-border dark:border-claude-dark-border flex items-center gap-3 bg-white dark:bg-claude-dark-card">
        <h1 className="text-xl font-semibold text-claude-text dark:text-claude-dark-text">Tag Manager</h1>
        <button
          onClick={loadTags}
          disabled={loading}
          className="btn-primary text-sm"
        >
          {loading ? 'Loading...' : 'Load Tags'}
        </button>
        <button
          onClick={() => setShowMergeDialog(true)}
          disabled={tags.length < 2}
          className="btn-secondary text-sm"
        >
          Merge Tags
        </button>
        <span className="text-sm text-claude-text-secondary dark:text-claude-dark-text-secondary ml-auto">{tags.length} tags</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tag Tree Panel */}
        <div className="w-1/2 border-r border-claude-border dark:border-claude-dark-border overflow-auto p-4">
          {tree.length === 0 ? (
            <div className="text-claude-text-secondary dark:text-claude-dark-text-secondary text-center py-12">
              No tags found.
              <br />
              Click "Load Tags" to fetch tags.
            </div>
          ) : (
            <TagTree
              nodes={tree}
              selectedTag={selectedTag}
              onSelect={selectTag}
              editingTag={editingTag}
              editName={editName}
              setEditName={setEditName}
              onStartRename={startRename}
              onSaveRename={saveRename}
              onCancelRename={cancelRename}
            />
          )}
        </div>

        {/* Memory List Panel */}
        <div className="w-1/2 overflow-auto p-4">
          {selectedTag ? (
            <>
              <h2 className="text-lg font-semibold text-claude-text dark:text-claude-dark-text mb-4">
                Memories tagged "{selectedTag.name}" ({memories.length})
              </h2>
              {memories.length === 0 ? (
                <div className="text-claude-text-secondary dark:text-claude-dark-text-secondary">No memories with this tag.</div>
              ) : (
                <div className="space-y-3">
                  {memories.map((memory) => (
                    <div key={memory.id} className="card p-4">
                      <h3 className="font-medium text-claude-text dark:text-claude-dark-text">{memory.name}</h3>
                      <p className="text-sm text-claude-text-secondary dark:text-claude-dark-text-secondary truncate mt-1">
                        {memory.content.slice(0, 100)}
                        {memory.content.length > 100 && '...'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-claude-text-secondary dark:text-claude-dark-text-secondary text-center py-12">
              Select a tag to view its memories
            </div>
          )}
        </div>
      </div>

      {/* Merge Dialog */}
      {showMergeDialog && (
        <MergeDialog
          tags={tags}
          app={app}
          onClose={() => setShowMergeDialog(false)}
          onMerged={loadTags}
        />
      )}
    </div>
  );
}

interface TagTreeProps {
  nodes: TagTreeNode[];
  selectedTag: Tag | null;
  onSelect: (tag: Tag) => void;
  editingTag: number | null;
  editName: string;
  setEditName: (name: string) => void;
  onStartRename: (tag: Tag) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  depth?: number;
}

function TagTree({
  nodes,
  selectedTag,
  onSelect,
  editingTag,
  editName,
  setEditName,
  onStartRename,
  onSaveRename,
  onCancelRename,
  depth = 0
}: TagTreeProps) {
  return (
    <ul className={depth > 0 ? 'ml-4 border-l border-claude-border dark:border-claude-dark-border pl-3' : ''}>
      {nodes.map((node) => (
        <li key={node.id} className="py-1">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-claude cursor-pointer transition-colors ${
              selectedTag?.id === node.id
                ? 'bg-claude-coral-light dark:bg-claude-coral/20 text-claude-coral'
                : 'hover:bg-claude-beige dark:hover:bg-claude-dark-card text-claude-text dark:text-claude-dark-text'
            }`}
            onClick={() => onSelect(node)}
          >
            {node.children.length > 0 && (
              <span className="text-claude-text-secondary text-xs">▼</span>
            )}
            {editingTag === node.id ? (
              <input
                type="text"
                value={editName}
                onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveRename();
                  if (e.key === 'Escape') onCancelRename();
                }}
                onBlur={onSaveRename}
                className="px-1 py-0.5 text-sm bg-white dark:bg-gray-800 border rounded"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onDblClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  onStartRename(node);
                }}
              >
                {node.name}
              </span>
            )}
            <span className="text-gray-400 text-xs">({node.memory_count})</span>
          </div>
          {node.children.length > 0 && (
            <TagTree
              nodes={node.children}
              selectedTag={selectedTag}
              onSelect={onSelect}
              editingTag={editingTag}
              editName={editName}
              setEditName={setEditName}
              onStartRename={onStartRename}
              onSaveRename={onSaveRename}
              onCancelRename={onCancelRename}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

interface MergeDialogProps {
  tags: Tag[];
  app: App | null;
  onClose: () => void;
  onMerged: () => void;
}

function MergeDialog({ tags, app, onClose, onMerged }: MergeDialogProps) {
  const [sourceId, setSourceId] = useState<number | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const handleMerge = async () => {
    if (!app || sourceId === '' || targetId === '' || sourceId === targetId) return;
    setLoading(true);

    const sourceTag = tags.find(t => t.id === sourceId);
    const targetTag = tags.find(t => t.id === targetId);

    await app.callServerTool({
      name: 'merge_tags',
      arguments: { sourceTagId: sourceId, targetTagId: targetId }
    });

    await app.updateModelContext({
      content: [{ type: 'text', text: `Merged tag "${sourceTag?.name}" into "${targetTag?.name}"` }]
    });

    setLoading(false);
    onClose();
    onMerged();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-bold mb-4">Merge Tags</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Source Tag (will be deleted)
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(Number((e.target as HTMLSelectElement).value) || '')}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select tag...</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id} disabled={tag.id === targetId}>
                  {tag.name} ({tag.memory_count} memories)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Target Tag (will be kept)
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(Number((e.target as HTMLSelectElement).value) || '')}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select tag...</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id} disabled={tag.id === sourceId}>
                  {tag.name} ({tag.memory_count} memories)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={loading || sourceId === '' || targetId === '' || sourceId === targetId}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Merging...' : 'Merge'}
          </button>
        </div>
      </div>
    </div>
  );
}

render(<TagManager />, document.getElementById('app')!);
