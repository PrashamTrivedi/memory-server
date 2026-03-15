import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useInfiniteMemories } from '../api/memory';
import { useTagHierarchy } from '../hooks/useTagHierarchy';
import { AppPage } from '../App';

interface CommandPaletteProps {
  onClose: () => void;
  onSelectMemory: (id: string) => void;
  onNavigate: (page: AppPage) => void;
  onCreateMemory: () => void;
  onFilterByTag: (tag: string) => void;
}

interface Action {
  id: string;
  type: 'memory' | 'action' | 'tag' | 'nav';
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: string;
}

export function CommandPalette({
  onClose,
  onSelectMemory,
  onNavigate,
  onCreateMemory,
  onFilterByTag,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: memoriesData } = useInfiniteMemories(50);
  const { flatTree } = useTagHierarchy();

  const allMemories = useMemo(() =>
    memoriesData?.pages.flatMap(p => p.memories) || [],
    [memoriesData]
  );

  const fuse = useMemo(() => {
    const items: Action[] = [
      { id: 'create', type: 'action', title: 'Create new memory', icon: '+', shortcut: '' },
      { id: 'nav-memories', type: 'nav', title: 'Go to Memories', icon: 'M' },
      { id: 'nav-tags', type: 'nav', title: 'Go to Tags', icon: 'T' },
      { id: 'nav-settings', type: 'nav', title: 'Go to Settings', icon: 'S' },
      ...flatTree.map(tag => ({
        id: `tag-${tag.id}`,
        type: 'tag' as const,
        title: tag.name,
        subtitle: `Filter by tag`,
        icon: '#',
      })),
      ...allMemories.map(m => ({
        id: `memory-${m.id}`,
        type: 'memory' as const,
        title: m.name,
        subtitle: m.content.slice(0, 80),
        icon: 'D',
      })),
    ];

    return new Fuse(items, {
      keys: ['title', 'subtitle'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [allMemories, flatTree]);

  const results = useMemo(() => {
    if (!query.trim()) {
      const recent = allMemories.slice(0, 5).map(m => ({
        id: `memory-${m.id}`,
        type: 'memory' as const,
        title: m.name,
        subtitle: m.content.slice(0, 80),
        icon: 'D',
      }));
      const actions: Action[] = [
        { id: 'create', type: 'action', title: 'Create new memory', icon: '+' },
      ];
      return [...actions, ...recent];
    }
    return fuse.search(query).slice(0, 10).map(r => r.item);
  }, [query, fuse, allMemories]);

  useEffect(() => setSelectedIndex(0), [results]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        executeAction(results[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const executeAction = (action: Action) => {
    switch (action.type) {
      case 'memory':
        onSelectMemory(action.id.replace('memory-', ''));
        break;
      case 'tag':
        onFilterByTag(action.title);
        break;
      case 'action':
        if (action.id === 'create') onCreateMemory();
        onClose();
        break;
      case 'nav':
        if (action.id === 'nav-memories') onNavigate('memories');
        if (action.id === 'nav-tags') onNavigate('tags');
        if (action.id === 'nav-settings') onNavigate('settings');
        break;
    }
  };

  const typeColors: Record<string, string> = {
    memory: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30',
    tag: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30',
    action: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
    nav: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-warm-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-400 shrink-0"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories, tags, or actions..."
            className="flex-1 bg-transparent text-sm focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium"
          />
          <kbd className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-600 rounded-md px-1.5 py-0.5 font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400 font-medium">No results found</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                onClick={() => executeAction(item)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                  i === selectedIndex
                    ? 'bg-primary-50 dark:bg-primary-900/15'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
              >
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${typeColors[item.type] || ''}`}>
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 dark:text-slate-100 truncate font-medium">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</div>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 uppercase shrink-0 font-bold tracking-wider">{item.type}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[10px] text-slate-400 font-medium">
          <span><kbd className="border border-slate-200 dark:border-slate-600 rounded px-1 font-mono">&#x2191;&#x2193;</kbd> Navigate</span>
          <span><kbd className="border border-slate-200 dark:border-slate-600 rounded px-1 font-mono">&#x21B5;</kbd> Select</span>
          <span><kbd className="border border-slate-200 dark:border-slate-600 rounded px-1 font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
