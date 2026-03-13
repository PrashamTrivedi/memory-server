import { useState, useEffect, useCallback } from 'react';
import { useTheme } from './contexts/ThemeContext';
import { api } from './api/client';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MemoryListView } from './components/MemoryListView';
import { MemoryCardView } from './components/MemoryCardView';
import { PeekPanel } from './components/PeekPanel';
import { CommandPalette } from './components/CommandPalette';
import { Breadcrumbs } from './components/Breadcrumbs';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SettingsPage } from './pages/SettingsPage';
import { TagManagement } from './pages/TagManagement';
import { MemoryForm } from './components/MemoryForm';
import { useInfiniteMemories, useSearchMemories, useMemoriesByTag, useCreateMemory, useDeleteMemory, useTemporaryMemories } from './api/memory';
import { useTagHierarchy } from './hooks/useTagHierarchy';
import { useDebounce } from './hooks/useDebounce';
import { Memory, TemporaryMemoryWithMetadata } from './types/memory';
import './styles.css';

export type AppPage = 'memories' | 'tags' | 'settings';
export type ViewMode = 'list' | 'card';
export type SortMode = 'created' | 'updated' | 'alpha';
export type MemoryFilter = 'all' | 'permanent' | 'temporary';

function App() {
  const { theme } = useTheme();
  const [page, setPage] = useState<AppPage>('memories');
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('viewMode') as ViewMode) || 'card'
  );
  const [sortMode, setSortMode] = useState<SortMode>('created');
  const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const tagHierarchy = useTagHierarchy();

  // Data fetching
  const infiniteMemories = useInfiniteMemories(20);
  const searchResults = useSearchMemories({
    query: debouncedQuery,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    limit: 50,
  });
  const tagFilterResults = useMemoriesByTag(
    selectedTags.length === 1 && !debouncedQuery ? selectedTags[0] : null
  );
  const temporaryMemories = useTemporaryMemories(100);
  const createMemory = useCreateMemory();
  const deleteMemory = useDeleteMemory();

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  // Check API key
  useEffect(() => {
    setShowApiKeyPrompt(!api.getApiKey());
  }, []);

  // Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
      }
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Resolve memories based on current state
  const getMemories = useCallback((): Memory[] => {
    if (debouncedQuery || selectedTags.length > 0) {
      return searchResults.data?.memories || [];
    }
    if (selectedTags.length === 1 && tagFilterResults.data) {
      return tagFilterResults.data.memories;
    }
    const pages = infiniteMemories.data?.pages || [];
    return pages.flatMap(p => p.memories);
  }, [debouncedQuery, selectedTags, searchResults.data, tagFilterResults.data, infiniteMemories.data]);

  const allMemories = getMemories();

  // Merge temporary memories if filter allows
  const tempMems = temporaryMemories.data?.memories || [];
  const displayMemories = (() => {
    if (memoryFilter === 'temporary') {
      return tempMems.map(tm => ({ ...tm, _temporary: true as const }));
    }
    if (memoryFilter === 'permanent') {
      return allMemories.map(m => ({ ...m, _temporary: false as const }));
    }
    // 'all' - merge, marking temporary ones
    const tempIds = new Set(tempMems.map(t => t.id));
    const merged = [
      ...allMemories.map(m => ({ ...m, _temporary: tempIds.has(m.id) })),
      ...tempMems
        .filter(tm => !allMemories.some(m => m.id === tm.id))
        .map(tm => ({ ...tm, _temporary: true as const })),
    ];
    return merged;
  })();

  // Sort memories
  const sortedMemories = [...displayMemories].sort((a, b) => {
    switch (sortMode) {
      case 'updated': return b.updated_at - a.updated_at;
      case 'alpha': return a.name.localeCompare(b.name);
      default: return b.created_at - a.created_at;
    }
  });

  // Find temp metadata for a memory
  const getTempMetadata = (id: string): TemporaryMemoryWithMetadata | undefined =>
    tempMems.find(t => t.id === id);

  const selectedMemory = sortedMemories.find(m => m.id === selectedMemoryId);

  const handleTagSelect = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
    setPage('memories');
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      api.setApiKey(apiKeyInput.trim());
      setShowApiKeyPrompt(false);
      setApiKeyInput('');
      window.location.reload();
    }
  };

  const isLoading = infiniteMemories.isLoading || searchResults.isLoading;
  const hasMore = infiniteMemories.hasNextPage && !debouncedQuery && selectedTags.length === 0;

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-14 md:pb-0" data-theme={theme}>
      {/* API Key Modal */}
      {showApiKeyPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 max-w-md w-[90%] animate-scale-in">
            <h2 className="text-xl font-bold mb-2">Configure API Key</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              Enter your admin API key to use the Memory Server UI.
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="msk_..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 font-mono text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium text-sm"
              >
                Save API Key
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              See <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">docs/API_KEY_MANAGEMENT.md</code> for setup instructions.
            </p>
          </div>
        </div>
      )}

      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onCreateMemory={() => setShowCreateForm(true)}
        currentPage={page}
        onNavigate={(p) => { setPage(p); setSelectedMemoryId(null); }}
      />

      <Layout
        sidebarOpen={sidebarOpen}
        peekOpen={!!selectedMemoryId && page === 'memories'}
        sidebar={
          <Sidebar
            tagHierarchy={tagHierarchy}
            selectedTags={selectedTags}
            onTagSelect={handleTagSelect}
            onClearTags={() => setSelectedTags([])}
          />
        }
        peek={
          selectedMemory && page === 'memories' ? (
            <PeekPanel
              memory={selectedMemory}
              tempMetadata={getTempMetadata(selectedMemory.id)}
              onClose={() => setSelectedMemoryId(null)}
              onDelete={(id) => {
                deleteMemory.mutate(id);
                setSelectedMemoryId(null);
              }}
              onTagClick={handleTagSelect}
            />
          ) : null
        }
      >
        {page === 'memories' && (
          <div className="flex flex-col h-full">
            {/* Breadcrumbs + View Controls */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shrink-0">
              <Breadcrumbs
                selectedTags={selectedTags}
                selectedMemory={selectedMemory || null}
                onNavigateHome={() => { setSelectedTags([]); setSelectedMemoryId(null); }}
                onRemoveTag={(tag) => setSelectedTags(prev => prev.filter(t => t !== tag))}
                onClearMemory={() => setSelectedMemoryId(null)}
              />
              <div className="flex items-center gap-2">
                {/* Memory filter */}
                <select
                  value={memoryFilter}
                  onChange={(e) => setMemoryFilter(e.target.value as MemoryFilter)}
                  className="text-xs border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  <option value="all">All</option>
                  <option value="permanent">Permanent</option>
                  <option value="temporary">Temporary</option>
                </select>
                {/* Sort */}
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="text-xs border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  <option value="created">Newest</option>
                  <option value="updated">Recently Updated</option>
                  <option value="alpha">A-Z</option>
                </select>
                {/* View toggle */}
                <div className="flex border border-slate-200 dark:border-slate-600 rounded-md overflow-hidden">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                    title="List view"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                  </button>
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-1.5 ${viewMode === 'card' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                    title="Card view"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Memory content */}
            <div className="flex-1 overflow-y-auto p-6">
              {showCreateForm && (
                <div className="mb-6">
                  <MemoryForm
                    onSubmit={async (data) => {
                      await createMemory.mutateAsync(data);
                      setShowCreateForm(false);
                    }}
                    onCancel={() => setShowCreateForm(false)}
                    isLoading={createMemory.isPending}
                  />
                </div>
              )}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sortedMemories.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <p className="text-lg font-medium">No memories found</p>
                  <p className="text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              ) : viewMode === 'list' ? (
                <MemoryListView
                  memories={sortedMemories}
                  selectedId={selectedMemoryId}
                  onSelect={setSelectedMemoryId}
                  onTagClick={handleTagSelect}
                  getTempMetadata={getTempMetadata}
                />
              ) : (
                <MemoryCardView
                  memories={sortedMemories}
                  selectedId={selectedMemoryId}
                  onSelect={setSelectedMemoryId}
                  onTagClick={handleTagSelect}
                  getTempMetadata={getTempMetadata}
                />
              )}
              {hasMore && (
                <div className="text-center py-4">
                  <button
                    onClick={() => infiniteMemories.fetchNextPage()}
                    disabled={infiniteMemories.isFetchingNextPage}
                    className="px-4 py-2 text-sm text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                  >
                    {infiniteMemories.isFetchingNextPage ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {page === 'tags' && <TagManagement />}
        {page === 'settings' && <SettingsPage />}
      </Layout>

      {/* Mobile bottom nav */}
      <MobileBottomNav
        currentPage={page}
        onNavigate={(p) => { setPage(p); setSelectedMemoryId(null); }}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onCreateMemory={() => { setPage('memories'); setShowCreateForm(true); }}
      />

      {/* Command Palette */}
      {commandPaletteOpen && (
        <CommandPalette
          onClose={() => setCommandPaletteOpen(false)}
          onSelectMemory={(id) => {
            setSelectedMemoryId(id);
            setPage('memories');
            setCommandPaletteOpen(false);
          }}
          onNavigate={(p) => {
            setPage(p);
            setCommandPaletteOpen(false);
          }}
          onCreateMemory={() => {
            setPage('memories');
            setShowCreateForm(true);
            setCommandPaletteOpen(false);
          }}
          onFilterByTag={(tag) => {
            handleTagSelect(tag);
            setCommandPaletteOpen(false);
          }}
          viewMode={viewMode}
          onToggleView={() => setViewMode(prev => prev === 'list' ? 'card' : 'list')}
        />
      )}
    </div>
  );
}

export default App;
