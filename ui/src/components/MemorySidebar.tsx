import { useState } from 'react';
import { Memory, TemporaryMemoryWithMetadata } from '../types/memory';

interface MemorySidebarProps {
  memories: (Memory & { _temporary?: boolean })[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getTempMetadata: (id: string) => TemporaryMemoryWithMetadata | undefined;
  isLoading: boolean;
  minimized: boolean;
}

export function MemorySidebar({
  memories,
  selectedId,
  onSelect,
  getTempMetadata,
  isLoading,
  minimized,
}: MemorySidebarProps) {
  const [localFilter, setLocalFilter] = useState('');

  const filteredMemories = localFilter
    ? memories.filter(m => m.name.toLowerCase().includes(localFilter.toLowerCase()))
    : memories;

  if (minimized) {
    return (
      <div className="flex flex-col h-full items-center py-3 gap-1">
        {memories.slice(0, 20).map(m => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
              m.id === selectedId
                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title={m.name}
          >
            {m.name.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 mb-2 px-0.5">
          Memories
        </h3>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            value={localFilter}
            onChange={(e) => setLocalFilter(e.target.value)}
            placeholder="Filter..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-200 dark:bg-slate-700 mx-3" />

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto pt-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="px-3 py-10 text-center text-xs text-slate-400">
            {localFilter ? 'No matching memories' : 'No memories yet'}
          </div>
        ) : (
          <div className="px-1.5 py-1 space-y-0.5">
            {filteredMemories.map(memory => {
              const isSelected = memory.id === selectedId;
              const tempMeta = memory._temporary ? getTempMetadata(memory.id) : undefined;

              return (
                <button
                  key={memory.id}
                  onClick={() => onSelect(memory.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg transition-all group relative ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/25'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {/* Left accent bar */}
                  {isSelected && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary-500" />
                  )}

                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isSelected
                        ? 'bg-primary-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
                    }`}>
                      {memory.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[13px] leading-tight truncate block ${
                        isSelected
                          ? 'font-semibold text-primary-800 dark:text-primary-300'
                          : 'font-medium text-slate-700 dark:text-slate-300'
                      }`}>
                        {memory.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block mt-0.5">
                        {formatDate(memory.created_at)}
                        {memory.tags && memory.tags.length > 0 && (
                          <> &middot; {memory.tags.slice(0, 2).join(', ')}</>
                        )}
                      </span>
                    </div>
                    {tempMeta && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-800" title="Temporary" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
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
