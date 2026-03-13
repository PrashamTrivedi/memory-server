import { useState } from 'react';
import { ApiKeys } from './ApiKeys';
import { SkillDownload } from './SkillDownload';
import { McpAppsAdmin } from './McpAppsAdmin';

type SettingsTab = 'api-keys' | 'skill' | 'mcp-apps';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api-keys');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shrink-0">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage API keys, skills, and MCP apps</p>
        <div className="flex gap-1 mt-3">
          <TabButton active={activeTab === 'api-keys'} onClick={() => setActiveTab('api-keys')}>API Keys</TabButton>
          <TabButton active={activeTab === 'skill'} onClick={() => setActiveTab('skill')}>Skill Package</TabButton>
          <TabButton active={activeTab === 'mcp-apps'} onClick={() => setActiveTab('mcp-apps')}>MCP Apps</TabButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
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
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
