import { Memory, TemporaryMemoryWithMetadata } from '../types/memory';
import { TagPill } from './TagPill';

interface MemoryListViewProps {
  memories: (Memory & { _temporary?: boolean })[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTagClick: (tag: string) => void;
  getTempMetadata: (id: string) => TemporaryMemoryWithMetadata | undefined;
}

export function MemoryListView({ memories, selectedId, onSelect, onTagClick, getTempMetadata }: MemoryListViewProps) {
  return (
    <div className="space-y-px">
      {memories.map(memory => {
        const isSelected = memory.id === selectedId;
        const tempMeta = memory._temporary ? getTempMetadata(memory.id) : undefined;
        const snippet = memory.content.slice(0, 200).replace(/\n/g, ' ');

        return (
          <button
            key={memory.id}
            onClick={() => onSelect(memory.id)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors group ${
              isSelected
                ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                : 'hover:bg-white dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                    {memory.name}
                  </h3>
                  {tempMeta && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      Stage {tempMeta.stage} · {tempMeta.days_until_expiry}d left
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                  {snippet}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {memory.tags && memory.tags.slice(0, 4).map(tag => (
                    <TagPill key={tag} tag={tag} onClick={onTagClick} size="sm" />
                  ))}
                  {memory.tags && memory.tags.length > 4 && (
                    <span className="text-[10px] text-slate-400">+{memory.tags.length - 4}</span>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                {formatDate(memory.created_at)}
              </div>
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
