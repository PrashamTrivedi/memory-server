import { useState, useEffect, useRef } from 'react';
import { Memory } from '../types/memory';

interface InlineEditorProps {
  memory: Memory;
  onSave: (data: { name: string; content: string; tags: string[]; url: string }) => void;
  onDiscard: () => void;
  isSaving: boolean;
}

export function InlineEditor({ memory, onSave, onDiscard, isSaving }: InlineEditorProps) {
  const [name, setName] = useState(memory.name);
  const [content, setContent] = useState(memory.content);
  const [tags, setTags] = useState((memory.tags || []).join(', '));
  const [url, setUrl] = useState(memory.url || '');
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  // Handle Cmd+Enter to save, Esc to discard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onDiscard();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [name, content, tags, url]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    onSave({ name, content, tags: parsedTags, url });
  };

  return (
    <div className="p-5 space-y-4">
      {/* Save/Discard bar */}
      <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/20 rounded-lg px-4 py-2 border border-primary-200 dark:border-primary-800">
        <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">Editing</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscard}
            className="px-3 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Discard <kbd className="ml-1 text-[10px] text-slate-400">Esc</kbd>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1 text-xs rounded-md bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'} <kbd className="ml-1 text-[10px] text-primary-200">⌘↵</kbd>
          </button>
        </div>
      </div>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-lg font-semibold bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-primary-500 focus:outline-none pb-1 text-slate-900 dark:text-slate-100"
        placeholder="Memory name"
      />

      {/* Content */}
      <textarea
        ref={contentRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full min-h-[300px] bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y leading-relaxed"
        placeholder="Write markdown content..."
      />

      {/* Tags */}
      <div>
        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Tags (comma separated)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full px-3 py-2 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="tag1, tag2, parent>child"
        />
      </div>

      {/* URL */}
      <div>
        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Reference URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="https://..."
        />
      </div>
    </div>
  );
}
