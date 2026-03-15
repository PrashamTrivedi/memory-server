import { RefObject, useEffect, useRef } from 'react';
import { useMemoriesByTag } from '../api/memory';

interface TagPreviewProps {
  tag: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function TagPreview({ tag, onClose }: TagPreviewProps) {
  const { data, isLoading } = useMemoriesByTag(tag);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const memories = data?.memories || [];
  const count = memories.length;

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full mt-1 z-50 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-3 animate-scale-in"
      onMouseLeave={onClose}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{tag}</span>
        <span className="text-xs text-slate-400 tabular-nums">
          {isLoading ? '...' : `${count} ${count === 1 ? 'memory' : 'memories'}`}
        </span>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : memories.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">No memories with this tag</p>
      ) : (
        <ul className="space-y-1.5">
          {memories.slice(0, 5).map(m => (
            <li key={m.id} className="text-xs text-slate-600 dark:text-slate-300 truncate">
              {m.name}
            </li>
          ))}
          {memories.length > 5 && (
            <li className="text-xs text-primary-500 font-medium">
              View all {count} →
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
