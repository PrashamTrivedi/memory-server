import { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Memory, TemporaryMemoryWithMetadata } from '../types/memory';
import { useUpdateMemory, usePromoteMemory } from '../api/memory';
import { TagPill } from './TagPill';
import { InlineEditor } from './InlineEditor';

interface PeekPanelProps {
  memory: Memory;
  tempMetadata?: TemporaryMemoryWithMetadata;
  onClose: () => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
}

export function PeekPanel({ memory, tempMetadata, onClose, onDelete, onTagClick }: PeekPanelProps) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateMemory = useUpdateMemory();
  const promoteMemory = usePromoteMemory();

  // Close on Esc (when not editing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editing) {
        onClose();
      }
      if (e.key === 'e' && !editing && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setEditing(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, editing]);

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
            {memory.name}
          </h2>
          {tempMetadata && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              Temp · Stage {tempMetadata.stage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {tempMetadata && (
            <button
              onClick={() => promoteMemory.mutate(memory.id)}
              className="px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
              disabled={promoteMemory.isPending}
            >
              {promoteMemory.isPending ? 'Promoting...' : 'Promote'}
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
              title="Edit (E)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-300">Delete this memory?</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-xs rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={() => { onDelete(memory.id); setShowDeleteConfirm(false); }}
              className="px-3 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
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
          <div
            className="px-5 py-4"
            onDoubleClick={() => setEditing(true)}
          >
            {/* Metadata */}
            <div className="flex items-center gap-3 mb-4 text-xs text-slate-400 dark:text-slate-500">
              <span className="tabular-nums">Created {formatFullDate(memory.created_at)}</span>
              {memory.updated_at !== memory.created_at && (
                <span className="tabular-nums">Updated {formatFullDate(memory.updated_at)}</span>
              )}
            </div>

            {/* URL */}
            {memory.url && (
              <a
                href={memory.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-xs text-primary-500 hover:text-primary-600 mb-4 max-w-full"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                <span className="truncate">{memory.url}</span>
              </a>
            )}

            {/* Tags */}
            {memory.tags && memory.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {memory.tags.map(tag => (
                  <TagPill key={tag} tag={tag} onClick={onTagClick} />
                ))}
              </div>
            )}

            {/* Rendered markdown content */}
            <article className="prose prose-slate dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary-500 prose-code:text-xs prose-code:bg-slate-100 prose-code:dark:bg-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-50 prose-pre:dark:bg-slate-800 prose-pre:border prose-pre:border-slate-200 prose-pre:dark:border-slate-700">
              <Markdown remarkPlugins={[remarkGfm]}>
                {memory.content}
              </Markdown>
            </article>

            {/* Temp metadata */}
            {tempMetadata && (
              <div className="mt-6 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">Temporary Memory</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Stage:</span>{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{tempMetadata.stage}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Expires in:</span>{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{tempMetadata.days_until_expiry} days</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Accesses:</span>{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{tempMetadata.access_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Last accessed:</span>{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{formatFullDate(tempMetadata.last_accessed)}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>Progress to {tempMetadata.stage === 1 ? 'Stage 2' : 'Permanent'}</span>
                    <span>{tempMetadata.access_count}/{tempMetadata.stage === 1 ? 5 : 15}</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
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
