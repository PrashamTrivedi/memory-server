import { Memory, TemporaryMemoryWithMetadata } from '../types/memory';
import { TagPill } from './TagPill';

interface MemoryCardViewProps {
  memories: (Memory & { _temporary?: boolean })[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTagClick: (tag: string) => void;
  getTempMetadata: (id: string) => TemporaryMemoryWithMetadata | undefined;
}

export function MemoryCardView({ memories, selectedId, onSelect, onTagClick, getTempMetadata }: MemoryCardViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {memories.map(memory => {
        const isSelected = memory.id === selectedId;
        const tempMeta = memory._temporary ? getTempMetadata(memory.id) : undefined;
        const preview = memory.content.slice(0, 300).replace(/\n/g, ' ');

        return (
          <button
            key={memory.id}
            onClick={() => onSelect(memory.id)}
            className={`text-left rounded-xl border transition-all p-5 group ${
              isSelected
                ? 'bg-white dark:bg-slate-800 border-primary-300 dark:border-primary-700 shadow-md ring-1 ring-primary-200 dark:ring-primary-800'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                {memory.name}
              </h3>
              {tempMeta && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                  Temp · {tempMeta.days_until_expiry}d
                </span>
              )}
            </div>

            {/* Content preview */}
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed mb-3">
              {preview}
            </p>

            {/* Tags */}
            {memory.tags && memory.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {memory.tags.slice(0, 3).map(tag => (
                  <TagPill key={tag} tag={tag} onClick={onTagClick} size="sm" />
                ))}
                {memory.tags.length > 3 && (
                  <span className="text-[10px] text-slate-400 self-center">+{memory.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
              <span className="tabular-nums">{formatDate(memory.created_at)}</span>
              {memory.url && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
