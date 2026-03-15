import { useState } from 'react';
import { ApiKeys } from './ApiKeys';
import { SkillDownload } from './SkillDownload';
import { McpAppsAdmin } from './McpAppsAdmin';

type SettingsTab = 'api-keys' | 'skill' | 'mcp-apps';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api-keys');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shrink-0">
        <h1
          className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 tracking-tight"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage API keys, skills, and MCP apps</p>
        <div className="flex gap-1 mt-4">
          <TabButton active={activeTab === 'api-keys'} onClick={() => setActiveTab('api-keys')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            API Keys
          </TabButton>
          <TabButton active={activeTab === 'skill'} onClick={() => setActiveTab('skill')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Skill Package
          </TabButton>
          <TabButton active={activeTab === 'mcp-apps'} onClick={() => setActiveTab('mcp-apps')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            MCP Apps
          </TabButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'api-keys' && <ApiKeys />}
        {activeTab === 'skill' && <SkillDownload />}
        {activeTab === 'mcp-apps' && <McpAppsAdmin />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
        active
          ? 'bg-primary-50 dark:bg-primary-900/25 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800/50'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}
