import { useState, useRef } from 'react';
import { TagPreview } from './TagPreview';

interface TagPillProps {
  tag: string;
  onClick: (tag: string) => void;
  size?: 'sm' | 'md';
}

export function TagPill({ tag, onClick, size = 'md' }: TagPillProps) {
  const [showPreview, setShowPreview] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const pillRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setShowPreview(true), 250);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    setShowPreview(false);
  };

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2.5 py-0.5 text-[11px]';

  return (
    <span className="relative" ref={pillRef}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(tag); }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center rounded-full font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 transition-all border border-transparent hover:border-primary-200 dark:hover:border-primary-800/50 ${sizeClasses}`}
      >
        <span className="w-1 h-1 rounded-full bg-primary-400 mr-1.5 opacity-60" />
        {tag}
      </button>
      {showPreview && (
        <TagPreview
          tag={tag}
          anchorRef={pillRef}
          onClose={() => setShowPreview(false)}
        />
      )}
    </span>
  );
}
