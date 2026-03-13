import { ReactNode } from 'react';

interface LayoutProps {
  sidebarOpen: boolean;
  peekOpen: boolean;
  sidebar: ReactNode;
  peek: ReactNode | null;
  children: ReactNode;
}

export function Layout({ sidebarOpen, peekOpen, sidebar, peek, children }: LayoutProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800
          transition-all duration-250 overflow-hidden
          ${sidebarOpen ? 'w-[280px]' : 'w-0'}
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:top-[57px]
          ${sidebarOpen ? 'max-lg:w-[280px] max-lg:shadow-xl' : 'max-lg:w-0'}
        `}
      >
        <div className="w-[280px] h-full overflow-y-auto">
          {sidebar}
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 lg:hidden top-[57px]" />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900">
        {children}
      </main>

      {/* Peek panel */}
      {peekOpen && peek && (
        <aside className="shrink-0 w-[480px] border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-slide-in-right overflow-hidden max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:top-[57px] max-lg:w-full max-lg:max-w-[480px] max-lg:shadow-xl max-md:max-w-full">
          {peek}
        </aside>
      )}
    </div>
  );
}
