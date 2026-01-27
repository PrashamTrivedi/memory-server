import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { App } from '@modelcontextprotocol/ext-apps';
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

    mcpApp.ontoolresult = (event) => {
      const tagsData = parseToolResult<TagsData>(event.result);
      if (tagsData?.tags) {
        setTags(tagsData.tags);
        setTree(buildTree(tagsData.tags));
      }

      const memoriesData = parseToolResult<MemoriesData>(event.result);
      if (memoriesData?.memories) {
        setMemories(memoriesData.memories);
      }

      setLoading(false);
    };

    mcpApp.connect();
    setApp(mcpApp);
    setConnected(true);
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
        <div className="text-gray-500">Connecting...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <h1 className="text-lg font-bold">Tag Manager</h1>
        <button
          onClick={loadTags}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load Tags'}
        </button>
        <button
          onClick={() => setShowMergeDialog(true)}
          disabled={tags.length < 2}
          className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          Merge Tags
        </button>
        <span className="text-sm text-gray-500 ml-auto">{tags.length} tags</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tag Tree Panel */}
        <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 overflow-auto p-4">
          {tree.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
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
              <h2 className="text-lg font-semibold mb-4">
                Memories tagged "{selectedTag.name}" ({memories.length})
              </h2>
              {memories.length === 0 ? (
                <div className="text-gray-500">No memories with this tag.</div>
              ) : (
                <div className="space-y-2">
                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded"
                    >
                      <h3 className="font-medium">{memory.name}</h3>
                      <p className="text-sm text-gray-500 truncate">
                        {memory.content.slice(0, 100)}
                        {memory.content.length > 100 && '...'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-center py-8">
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
    <ul className={depth > 0 ? 'ml-4 border-l border-gray-300 dark:border-gray-600 pl-2' : ''}>
      {nodes.map((node) => (
        <li key={node.id} className="py-1">
          <div
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
              selectedTag?.id === node.id
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => onSelect(node)}
          >
            {node.children.length > 0 && (
              <span className="text-gray-400 text-xs">▼</span>
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
