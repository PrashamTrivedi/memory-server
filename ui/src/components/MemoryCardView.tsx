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
      {memories.map((memory, index) => {
        const isSelected = memory.id === selectedId;
        const tempMeta = memory._temporary ? getTempMetadata(memory.id) : undefined;
        const preview = memory.content.slice(0, 280).replace(/\n/g, ' ');

        return (
          <button
            key={memory.id}
            onClick={() => onSelect(memory.id)}
            className={`text-left rounded-xl border transition-all duration-200 p-5 group relative overflow-hidden ${
              isSelected
                ? 'bg-white dark:bg-slate-800 border-primary-300 dark:border-primary-700 shadow-warm-lg ring-1 ring-primary-200/50 dark:ring-primary-800/50'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary-300/60 dark:hover:border-primary-700/60 hover:shadow-warm hover:-translate-y-0.5'
            }`}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            {/* Left accent bar */}
            <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-all duration-200 ${
              isSelected
                ? 'bg-primary-500 opacity-100'
                : 'bg-primary-400 opacity-0 group-hover:opacity-60'
            }`} />

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <h3
                className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug tracking-tight"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
              >
                {memory.name}
              </h3>
              {tempMeta && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                  {tempMeta.days_until_expiry}d
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
                  <span className="text-[10px] text-slate-400 self-center font-medium">+{memory.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700/50">
              <span className="tabular-nums font-medium">{formatDate(memory.created_at)}</span>
              {memory.url && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
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
