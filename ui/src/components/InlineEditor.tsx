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
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      {/* Save/Discard bar */}
      <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/15 rounded-xl px-4 py-2.5 border border-primary-200 dark:border-primary-800/50">
        <span className="text-xs text-primary-700 dark:text-primary-400 font-bold uppercase tracking-wider">Editing</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            Discard <kbd className="ml-1 text-[10px] text-slate-400 font-mono">Esc</kbd>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors font-semibold"
          >
            {isSaving ? 'Saving...' : 'Save'} <kbd className="ml-1 text-[10px] text-primary-200 font-mono">&#8984;&#x21B5;</kbd>
          </button>
        </div>
      </div>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-xl font-semibold bg-transparent border-b-2 border-slate-200 dark:border-slate-700 focus:border-primary-400 focus:outline-none pb-2 text-slate-900 dark:text-slate-100 tracking-tight"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        placeholder="Memory name"
      />

      {/* Content */}
      <textarea
        ref={contentRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full min-h-[300px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 resize-y leading-relaxed transition-all"
        placeholder="Write markdown content..."
      />

      {/* Tags */}
      <div>
        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Tags (comma separated)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all"
          placeholder="tag1, tag2, parent>child"
        />
      </div>

      {/* URL */}
      <div>
        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Reference URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all"
          placeholder="https://..."
        />
      </div>
    </div>
  );
}
