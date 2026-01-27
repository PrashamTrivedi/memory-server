import { render } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { App } from '@modelcontextprotocol/ext-apps';
import { marked } from 'marked';
import '../shared/styles/base.css';

interface Memory {
  id: string;
  name: string;
  content: string;
  tags: string[];
  url?: string;
  created_at: number;
  updated_at: number;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

function MemoryEditor() {
  const [app, setApp] = useState<App | null>(null);
  const [connected, setConnected] = useState(false);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [preview, setPreview] = useState('');

  // Update preview when content changes
  useEffect(() => {
    const html = marked(content, { async: false }) as string;
    setPreview(html);
  }, [content]);

  // Debounced save function
  const saveRef = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    const mcpApp = new App({ name: 'memory-editor', version: '1.0.0' });

    mcpApp.ontoolresult = (event) => {
      const data = parseToolResult<Memory>(event.result);
      if (data) {
        setMemory(data);
        setName(data.name || '');
        setContent(data.content || '');
        setTags(data.tags || []);
        setLastSaved(new Date());
      }
      setSaving(false);
    };

    mcpApp.connect();
    setApp(mcpApp);
    setConnected(true);
  }, []);

  const save = useCallback(async (newName: string, newContent: string, newTags: string[]) => {
    if (!app || !memory) return;
    setSaving(true);
    await app.callServerTool({
      name: 'update_memory',
      arguments: {
        id: memory.id,
        name: newName,
        content: newContent,
        tags: newTags
      }
    });
    await app.updateModelContext({
      content: [{ type: 'text', text: `Updated memory: ${newName}` }]
    });
  }, [app, memory]);

  // Create debounced save on mount
  useEffect(() => {
    saveRef.current = debounce((n: string, c: string, t: string[]) => {
      save(n, c, t);
    }, 1500);
  }, [save]);

  const handleNameChange = (e: Event) => {
    const newName = (e.target as HTMLInputElement).value;
    setName(newName);
    saveRef.current?.(newName, content, tags);
  };

  const handleContentChange = (e: Event) => {
    const newContent = (e.target as HTMLTextAreaElement).value;
    setContent(newContent);
    saveRef.current?.(name, newContent, tags);
  };

  const addTag = () => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    const newTags = [...tags, newTag.trim()];
    setTags(newTags);
    setNewTag('');
    saveRef.current?.(name, content, newTags);
  };

  const removeTag = (tag: string) => {
    const newTags = tags.filter(t => t !== tag);
    setTags(newTags);
    saveRef.current?.(name, content, newTags);
  };

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Connecting...</div>
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">
          Waiting for memory data...
          <br />
          <span className="text-sm">Use get_memory or update_memory to load a memory.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={name}
          onInput={handleNameChange}
          placeholder="Memory name..."
          className="w-full text-lg font-semibold bg-transparent border-none focus:outline-none"
        />

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                &times;
              </button>
            </span>
          ))}
          <input
            type="text"
            value={newTag}
            onInput={(e) => setNewTag((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add tag..."
            className="px-2 py-0.5 text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Save indicator */}
        <div className="text-xs text-gray-400 mt-2">
          {saving ? (
            <span className="text-yellow-600">Saving...</span>
          ) : lastSaved ? (
            <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
          ) : null}
        </div>
      </div>

      {/* Editor and Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="p-2 text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
            Markdown Editor
          </div>
          <textarea
            value={content}
            onInput={handleContentChange}
            placeholder="Write markdown content..."
            className="flex-1 p-4 font-mono text-sm bg-transparent resize-none focus:outline-none"
          />
        </div>

        {/* Preview Panel */}
        <div className="w-1/2 flex flex-col">
          <div className="p-2 text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
            Preview
          </div>
          <div
            className="flex-1 p-4 overflow-auto prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>
    </div>
  );
}

render(<MemoryEditor />, document.getElementById('app')!);
