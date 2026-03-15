import { render } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from '@modelcontextprotocol/ext-apps';
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
  const [connectionError, setConnectionError] = useState<string | null>(null);
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

    // Register ALL handlers BEFORE connect()

    // Handle tool input (when tool execution begins)
    mcpApp.ontoolinput = (params) => {
      console.log('[memory-editor] ontoolinput:', params);
      // Could show loading state here
    };

    // Handle tool result (when tool execution completes)
    mcpApp.ontoolresult = (params) => {
      console.log('[memory-editor] ontoolresult:', params);
      const data = parseToolResult<Memory>(params);
      if (data) {
        setMemory(data);
        setName(data.name || '');
        setContent(data.content || '');
        setTags(data.tags || []);
        setLastSaved(new Date());
      }
      setSaving(false);
    };

    // Handle host context changes (theme, styling)
    mcpApp.onhostcontextchanged = (ctx) => {
      console.log('[memory-editor] onhostcontextchanged:', ctx);
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
      console.log('[memory-editor] onteardown');
      return {};
    };

    // Now connect
    (async () => {
      try {
        await mcpApp.connect();
        setApp(mcpApp);
        setConnected(true);
        setConnectionError(null);
        console.log('[memory-editor] Connected successfully');
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[memory-editor] Connection failed:', errMsg);
        setConnectionError(errMsg);
      }
    })();
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

  if (!memory) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-claude-text-secondary dark:text-claude-dark-text-secondary text-center">
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
      <div className="p-4 border-b border-claude-border dark:border-claude-dark-border bg-white dark:bg-claude-dark-card">
        <input
          type="text"
          value={name}
          onInput={handleNameChange}
          placeholder="Memory name..."
          className="w-full text-xl font-semibold bg-transparent border-none focus:outline-none text-claude-text dark:text-claude-dark-text placeholder:text-claude-text-secondary"
        />

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="tag inline-flex items-center gap-1"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-claude-coral hover:text-claude-coral-hover ml-1"
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
            className="px-2 py-0.5 text-sm bg-transparent border-b border-claude-border dark:border-claude-dark-border focus:outline-none focus:border-claude-coral text-claude-text dark:text-claude-dark-text"
          />
        </div>

        {/* Save indicator */}
        <div className="text-xs mt-3">
          {saving ? (
            <span className="text-claude-coral">Saving...</span>
          ) : lastSaved ? (
            <span className="text-claude-text-secondary dark:text-claude-dark-text-secondary">Last saved: {lastSaved.toLocaleTimeString()}</span>
          ) : null}
        </div>
      </div>

      {/* Editor and Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-1/2 flex flex-col border-r border-claude-border dark:border-claude-dark-border">
          <div className="px-4 py-2 text-xs text-claude-text-secondary dark:text-claude-dark-text-secondary border-b border-claude-border dark:border-claude-dark-border bg-claude-beige dark:bg-claude-dark">
            Markdown Editor
          </div>
          <textarea
            value={content}
            onInput={handleContentChange}
            placeholder="Write markdown content..."
            className="flex-1 p-4 font-mono text-sm bg-transparent resize-none focus:outline-none text-claude-text dark:text-claude-dark-text placeholder:text-claude-text-secondary"
          />
        </div>

        {/* Preview Panel */}
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 text-xs text-claude-text-secondary dark:text-claude-dark-text-secondary border-b border-claude-border dark:border-claude-dark-border bg-claude-beige dark:bg-claude-dark">
            Preview
          </div>
          <div
            className="flex-1 p-4 overflow-auto prose prose-sm dark:prose-invert max-w-none prose-headings:text-claude-text dark:prose-headings:text-claude-dark-text"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>
    </div>
  );
}

render(<MemoryEditor />, document.getElementById('app')!);
