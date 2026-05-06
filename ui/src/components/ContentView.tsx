import { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Memory, TemporaryMemoryWithMetadata } from '../types/memory';
import { useUpdateMemory, usePromoteMemory } from '../api/memory';
import { TagPill } from './TagPill';
import { InlineEditor } from './InlineEditor';

interface ContentViewProps {
  memory: Memory;
  tempMetadata?: TemporaryMemoryWithMetadata;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onClose: () => void;
}

export function ContentView({ memory, tempMetadata, onDelete, onTagClick, onClose }: ContentViewProps) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState<'id' | 'name' | null>(null);
  const updateMemory = useUpdateMemory();
  const promoteMemory = usePromoteMemory();

  const copy = useCallback(async (value: string, kind: 'id' | 'name') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore — clipboard may be unavailable in non-secure contexts
    }
  }, []);

  useEffect(() => {
    setEditing(false);
    setShowDeleteConfirm(false);
  }, [memory.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' && !editing && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setEditing(true);
      }
      if (e.key === 'Escape' && !editing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, onClose]);

  const handleSave = useCallback(async (data: { name: string; content: string; tags: string[]; url: string }) => {
    await updateMemory.mutateAsync({
      id: memory.id,
      memory: {
        name: data.name,
        content: data.content,
        tags: data.tags,
        url: data.url || undefined,
      },
    });
    setEditing(false);
  }, [memory.id, updateMemory]);

  const handleDiscard = useCallback(() => {
    setEditing(false);
  }, []);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all shrink-0"
            title="Back to memories"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1
            className="font-semibold text-lg text-slate-900 dark:text-slate-100 truncate tracking-tight"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            {memory.name}
          </h1>
          <button
            onClick={() => copy(memory.name, 'name')}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all shrink-0"
            title={copied === 'name' ? 'Copied!' : 'Copy name'}
          >
            {copied === 'name' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            )}
          </button>
          {tempMetadata && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
              Temp &middot; Stage {tempMetadata.stage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {tempMetadata && (
            <button
              onClick={() => promoteMemory.mutate(memory.id)}
              className="px-3 py-1.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors border border-green-200 dark:border-green-800/50"
              disabled={promoteMemory.isPending}
            >
              {promoteMemory.isPending ? 'Promoting...' : 'Promote'}
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
              title="Edit (E)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all"
            title="Delete"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center justify-between shrink-0 animate-fade-in">
          <span className="text-sm text-red-700 dark:text-red-300 font-medium">Delete this memory permanently?</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-xs rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onDelete(memory.id); setShowDeleteConfirm(false); }}
              className="px-3 py-1 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-semibold"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {editing ? (
          <InlineEditor
            memory={memory}
            onSave={handleSave}
            onDiscard={handleDiscard}
            isSaving={updateMemory.isPending}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Metadata line */}
            <div className="flex items-center flex-wrap gap-3 mb-5 text-xs text-slate-400 dark:text-slate-500 font-medium">
              <button
                onClick={() => copy(memory.id, 'id')}
                className="inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all group"
                title={copied === 'id' ? 'Copied!' : 'Copy memory ID'}
              >
                <span className="font-mono text-[11px] tracking-tight">{memory.id}</span>
                {copied === 'id' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500"><path d="M20 6L9 17l-5-5"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50 group-hover:opacity-100 transition-opacity"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
              </button>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="tabular-nums">Created {formatFullDate(memory.created_at)}</span>
              {memory.updated_at !== memory.created_at && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="tabular-nums">Updated {formatFullDate(memory.updated_at)}</span>
                </>
              )}
            </div>

            {/* URL */}
            {memory.url && (
              <a
                href={memory.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-primary-600 dark:text-primary-400 hover:border-primary-300 dark:hover:border-primary-700 mb-5 max-w-full transition-colors group"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 group-hover:text-primary-500 transition-colors"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                <span className="truncate font-medium">{memory.url}</span>
              </a>
            )}

            {/* Tags */}
            {memory.tags && memory.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {memory.tags.map(tag => (
                  <TagPill key={tag} tag={tag} onClick={onTagClick} />
                ))}
              </div>
            )}

            {/* Rendered markdown — editorial typography */}
            <article className="prose prose-slate dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline prose-code:text-xs prose-code:bg-slate-100 prose-code:dark:bg-slate-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-50 prose-pre:dark:bg-slate-800 prose-pre:border prose-pre:border-slate-200 prose-pre:dark:border-slate-700 prose-p:leading-relaxed prose-li:leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm]}>
                {memory.content}
              </Markdown>
            </article>

            {/* Temp metadata panel */}
            {tempMetadata && (
              <div className="mt-8 p-5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-3">Temporary Memory</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Stage</span>
                    <span className="ml-2 font-bold text-slate-700 dark:text-slate-300">{tempMetadata.stage}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Expires in</span>
                    <span className="ml-2 font-bold text-slate-700 dark:text-slate-300">{tempMetadata.days_until_expiry} days</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Accesses</span>
                    <span className="ml-2 font-bold text-slate-700 dark:text-slate-300">{tempMetadata.access_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Last accessed</span>
                    <span className="ml-2 font-bold text-slate-700 dark:text-slate-300">{formatFullDate(tempMetadata.last_accessed)}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-medium">
                    <span>Progress to {tempMetadata.stage === 1 ? 'Stage 2' : 'Permanent'}</span>
                    <span className="tabular-nums">{tempMetadata.access_count}/{tempMetadata.stage === 1 ? 5 : 15}</span>
                  </div>
                  <div className="h-1.5 bg-amber-200/60 dark:bg-amber-900/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (tempMetadata.access_count / (tempMetadata.stage === 1 ? 5 : 15)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
