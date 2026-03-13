import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useInfiniteMemories } from '../api/memory';
import { useTagHierarchy } from '../hooks/useTagHierarchy';
import { AppPage, ViewMode } from '../App';

interface CommandPaletteProps {
  onClose: () => void;
  onSelectMemory: (id: string) => void;
  onNavigate: (page: AppPage) => void;
  onCreateMemory: () => void;
  onFilterByTag: (tag: string) => void;
  viewMode: ViewMode;
  onToggleView: () => void;
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
  viewMode,
  onToggleView,
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

  // Build searchable items
  const fuse = useMemo(() => {
    const items: Action[] = [
      // Actions
      { id: 'create', type: 'action', title: 'Create new memory', icon: '+', shortcut: '' },
      { id: 'toggle-view', type: 'action', title: `Switch to ${viewMode === 'list' ? 'card' : 'list'} view`, icon: '⊞' },
      // Nav
      { id: 'nav-memories', type: 'nav', title: 'Go to Memories', icon: '📄' },
      { id: 'nav-tags', type: 'nav', title: 'Go to Tags', icon: '🏷' },
      { id: 'nav-settings', type: 'nav', title: 'Go to Settings', icon: '⚙' },
      // Tags
      ...flatTree.map(tag => ({
        id: `tag-${tag.id}`,
        type: 'tag' as const,
        title: tag.name,
        subtitle: `Filter by tag`,
        icon: '#',
      })),
      // Memories
      ...allMemories.map(m => ({
        id: `memory-${m.id}`,
        type: 'memory' as const,
        title: m.name,
        subtitle: m.content.slice(0, 80),
        icon: '◎',
      })),
    ];

    return new Fuse(items, {
      keys: ['title', 'subtitle'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [allMemories, flatTree, viewMode]);

  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recent memories + actions
      const recent = allMemories.slice(0, 5).map(m => ({
        id: `memory-${m.id}`,
        type: 'memory' as const,
        title: m.name,
        subtitle: m.content.slice(0, 80),
        icon: '◎',
      }));
      const actions: Action[] = [
        { id: 'create', type: 'action', title: 'Create new memory', icon: '+' },
        { id: 'toggle-view', type: 'action', title: `Switch to ${viewMode === 'list' ? 'card' : 'list'} view`, icon: '⊞' },
      ];
      return [...actions, ...recent];
    }
    return fuse.search(query).slice(0, 10).map(r => r.item);
  }, [query, fuse, allMemories, viewMode]);

  // Reset selection on results change
  useEffect(() => setSelectedIndex(0), [results]);

  // Focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Keyboard nav
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

  // Scroll selected into view
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
        if (action.id === 'toggle-view') onToggleView();
        onClose();
        break;
      case 'nav':
        if (action.id === 'nav-memories') onNavigate('memories');
        if (action.id === 'nav-tags') onNavigate('tags');
        if (action.id === 'nav-settings') onNavigate('settings');
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories, tags, or actions..."
            className="flex-1 bg-transparent text-sm focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
          <kbd className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No results</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                onClick={() => executeAction(item)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="w-5 text-center text-xs text-slate-400 shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 dark:text-slate-100 truncate">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 uppercase shrink-0">{item.type}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[10px] text-slate-400">
          <span><kbd className="border border-slate-200 dark:border-slate-600 rounded px-1">↑↓</kbd> Navigate</span>
          <span><kbd className="border border-slate-200 dark:border-slate-600 rounded px-1">↵</kbd> Select</span>
          <span><kbd className="border border-slate-200 dark:border-slate-600 rounded px-1">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
