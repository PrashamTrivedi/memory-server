import { ReactNode } from 'react';

interface LayoutProps {
  leftSidebarOpen: boolean;
  leftSidebarMinimized: boolean;
  rightSidebarOpen: boolean;
  leftSidebar: ReactNode;
  rightSidebar: ReactNode | null;
  children: ReactNode;
}

export function Layout({
  leftSidebarOpen,
  leftSidebarMinimized,
  rightSidebarOpen,
  leftSidebar,
  rightSidebar,
  children,
}: LayoutProps) {
  const leftWidth = !leftSidebarOpen
    ? 'w-0'
    : leftSidebarMinimized
      ? 'w-[52px]'
      : 'w-[260px]';

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar — warm tinted background */}
      <aside
        className={`
          shrink-0 border-r border-slate-200 dark:border-slate-700
          bg-slate-50/80 dark:bg-slate-800/80
          transition-all duration-200 overflow-hidden
          ${leftWidth}
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:top-[56px]
          ${leftSidebarOpen ? (leftSidebarMinimized ? 'max-lg:w-[52px]' : 'max-lg:w-[260px] max-lg:shadow-warm-lg') : 'max-lg:w-0'}
        `}
      >
        <div className={`${leftSidebarMinimized ? 'w-[52px]' : 'w-[260px]'} h-full overflow-y-auto`}>
          {leftSidebar}
        </div>
      </aside>

      {/* Mobile overlay */}
      {leftSidebarOpen && !leftSidebarMinimized && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-30 lg:hidden top-[56px]" />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900">
        {children}
      </main>

      {/* Right sidebar — tags */}
      {rightSidebar && (
        <aside
          className={`
            shrink-0 border-l border-slate-200 dark:border-slate-700
            bg-slate-50/80 dark:bg-slate-800/80
            transition-all duration-200 overflow-hidden
            ${rightSidebarOpen ? 'w-[260px]' : 'w-0'}
            max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:top-[56px]
            ${rightSidebarOpen ? 'max-lg:w-[260px] max-lg:shadow-warm-lg' : 'max-lg:w-0'}
          `}
        >
          <div className="w-[260px] h-full overflow-y-auto">
            {rightSidebar}
          </div>
        </aside>
      )}
    </div>
  );
}
