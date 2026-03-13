import { useTheme } from '../contexts/ThemeContext';
import { AppPage } from '../App';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
  onCreateMemory: () => void;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

export function TopBar({
  searchQuery,
  onSearchChange,
  onToggleSidebar,
  onOpenCommandPalette,
  onCreateMemory,
  currentPage,
  onNavigate,
}: TopBarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-[57px] shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center px-4 gap-3 z-20">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
        title="Toggle sidebar ([)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>

      {/* Logo / App name */}
      <button
        onClick={() => onNavigate('memories')}
        className="font-semibold text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap hover:text-primary-500 transition-colors"
      >
        Memory Server
      </button>

      {/* Nav links */}
      <nav className="flex items-center gap-1 ml-2">
        <NavButton active={currentPage === 'memories'} onClick={() => onNavigate('memories')}>Memories</NavButton>
        <NavButton active={currentPage === 'tags'} onClick={() => onNavigate('tags')}>Tags</NavButton>
        <NavButton active={currentPage === 'settings'} onClick={() => onNavigate('settings')}>Settings</NavButton>
      </nav>

      {/* Search bar */}
      <div className="flex-1 max-w-xl mx-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            data-search-input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search memories... (/ to focus, Cmd+K for palette)"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title="Command palette"
      >
        <kbd className="font-mono">⌘K</kbd>
      </button>

      <button
        onClick={onCreateMemory}
        className="p-1.5 rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-colors"
        title="Create memory"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
      </button>

      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        )}
      </button>
    </header>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
