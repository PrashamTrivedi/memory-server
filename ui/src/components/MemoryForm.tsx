import { useState } from 'react';
import { CreateMemoryRequest } from '../types/memory';

interface MemoryFormProps {
  onSubmit: (data: CreateMemoryRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function MemoryForm({ onSubmit, onCancel, isLoading }: MemoryFormProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    await onSubmit({
      name,
      content,
      url: url || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm animate-fade-in"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Create Memory</h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Memory name"
          required
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Content (markdown supported)"
          required
          rows={6}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y leading-relaxed"
        />
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma separated)"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Reference URL (optional)"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !name.trim() || !content.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 font-medium"
        >
          {isLoading ? 'Creating...' : 'Create Memory'}
        </button>
      </div>
    </form>
  );
}
