import { useTheme } from '../contexts/ThemeContext';
import { AppPage } from '../App';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onOpenCommandPalette: () => void;
  onCreateMemory: () => void;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
}

export function TopBar({
  searchQuery,
  onSearchChange,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onOpenCommandPalette,
  onCreateMemory,
  currentPage,
  onNavigate,
  leftSidebarOpen,
  rightSidebarOpen,
}: TopBarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-[56px] shrink-0 border-b border-slate-200 bg-white dark:bg-slate-800 flex items-center px-4 gap-2 z-20 relative">
      {/* Left sidebar toggle */}
      <button
        onClick={onToggleLeftSidebar}
        className={`p-1.5 rounded-lg transition-all duration-200 ${
          leftSidebarOpen
            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
        title="Toggle memory list ([)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18"/>
        </svg>
      </button>

      {/* Logo */}
      <button
        onClick={() => onNavigate('memories')}
        className="font-display text-[17px] font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap hover:text-primary-600 dark:hover:text-primary-400 transition-colors tracking-tight"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        Memory Server
      </button>

      {/* Navigation — underline style */}
      <nav className="flex items-center gap-0.5 ml-3 h-full">
        <NavLink active={currentPage === 'memories'} onClick={() => onNavigate('memories')}>Memories</NavLink>
        <NavLink active={currentPage === 'tags'} onClick={() => onNavigate('tags')}>Tags</NavLink>
        <NavLink active={currentPage === 'settings'} onClick={() => onNavigate('settings')}>Settings</NavLink>
      </nav>

      {/* Search bar */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative group">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            data-search-input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Actions cluster */}
      <div className="flex items-center gap-1">
        {/* Command palette shortcut */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
          title="Command palette"
        >
          <kbd className="font-mono text-[10px]">&#8984;K</kbd>
        </button>

        {/* Create memory */}
        <button
          onClick={onCreateMemory}
          className="p-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all shadow-sm"
          title="Create memory"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          )}
        </button>

        {/* Right sidebar toggle */}
        <button
          onClick={onToggleRightSidebar}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            rightSidebarOpen
              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title="Toggle tags panel (])"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M15 3v18"/>
          </svg>
        </button>
      </div>
    </header>
  );
}

function NavLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1 text-[13px] font-semibold tracking-wide transition-colors h-full flex items-center ${
        active
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {children}
      {/* Active underline indicator */}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary-500 rounded-full" />
      )}
    </button>
  );
}
