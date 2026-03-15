import { Memory } from '../types/memory';

interface BreadcrumbsProps {
  selectedTags: string[];
  selectedMemory: Memory | null;
  onNavigateHome: () => void;
  onRemoveTag: (tag: string) => void;
  onClearMemory: () => void;
}

export function Breadcrumbs({ selectedTags, selectedMemory, onNavigateHome, onRemoveTag, onClearMemory }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 min-w-0">
      <button
        onClick={onNavigateHome}
        className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors shrink-0 font-semibold text-slate-700 dark:text-slate-300"
      >
        All Memories
      </button>

      {selectedTags.map(tag => (
        <span key={tag} className="flex items-center gap-1.5 min-w-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-slate-300 dark:text-slate-600"><path d="M9 18l6-6-6-6"/></svg>
          <button
            onClick={() => onRemoveTag(tag)}
            className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-[120px] font-medium"
            title={tag}
          >
            {tag}
          </button>
        </span>
      ))}

      {selectedMemory && (
        <span className="flex items-center gap-1.5 min-w-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-slate-300 dark:text-slate-600"><path d="M9 18l6-6-6-6"/></svg>
          <button
            onClick={onClearMemory}
            className="text-slate-800 dark:text-slate-200 truncate max-w-[200px] font-semibold"
            title={selectedMemory.name}
          >
            {selectedMemory.name}
          </button>
        </span>
      )}
    </nav>
  );
}
