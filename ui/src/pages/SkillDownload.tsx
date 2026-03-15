import { useState } from 'react';
import { api } from '../api/client';

interface SkillKey {
  id: string;
  entity_name: string;
  created_at: number;
}

interface SkillGenerateResponse {
  success: boolean;
  reused: boolean;
  download_url: string;
  expires_in: number;
  skill_key: SkillKey;
  instructions: {
    mcp_config_redacted: {
      mcpServers: {
        'memory-server': {
          transport: string;
          url: string;
          headers: {
            Authorization: string;
          };
        };
      };
    };
    steps: string[];
  };
}

export function SkillDownload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillData, setSkillData] = useState<SkillGenerateResponse | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const generateSkillPackage = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post<SkillGenerateResponse>('/skills/generate');

      // The response comes directly (success, download_url, etc. at top level)
      // Check if it's wrapped in data or direct
      const data = response.data || response;
      if (data && (data as SkillGenerateResponse).success) {
        setSkillData(data as SkillGenerateResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate skill package');
    } finally {
      setLoading(false);
    }
  };

  const downloadPackage = async () => {
    if (!skillData?.download_url) return;

    try {
      // The download_url is relative, like "/skills/download/{token}"
      const downloadUrl = skillData.download_url;

      // Create a temporary anchor element to trigger download
      const response = await fetch(downloadUrl);

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'memory-skill.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToastMessage('Skill package downloaded!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download skill package');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToastMessage('Copied to clipboard!');
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatExpiration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="max-w-[900px] mx-auto p-6 sm:p-8">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h1
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            Claude Code Skill
          </h1>
          <button
            onClick={generateSkillPackage}
            className="bg-primary-500 text-white hover:bg-primary-600 rounded-xl font-semibold px-5 py-2.5 text-[15px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Generate Skill Package
              </>
            )}
          </button>
        </div>

        <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed">
          Generate a pre-configured Claude Code skill package with MCP integration.
          The package includes a SKILL.md file and mcp.json with your API key for seamless setup.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-5 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {/* Skill Result */}
      {skillData && (
        <div className="animate-fade-in space-y-6">
          {/* Result Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h2
              className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              Skill Package Ready
              {skillData.reused && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-300 uppercase tracking-wide">
                  Reused
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-semibold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Expires in {formatExpiration(skillData.expires_in)}
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={downloadPackage}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download memory-skill.zip
          </button>

          {/* Skill Key Info Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h3
              className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              Skill Key Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Key ID</span>
                <span className="text-sm text-slate-800 dark:text-slate-200 font-mono break-all">{skillData.skill_key.id}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Entity Name</span>
                <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">{skillData.skill_key.entity_name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Created</span>
                <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">{formatDate(skillData.skill_key.created_at)}</span>
              </div>
            </div>
          </div>

          {/* MCP Configuration Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3
                className="text-base font-bold text-slate-900 dark:text-slate-100"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              >
                MCP Configuration
              </h3>
              <button
                onClick={() => copyToClipboard(JSON.stringify(skillData.instructions.mcp_config_redacted, null, 2))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Copy
              </button>
            </div>
            <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 font-mono text-xs overflow-x-auto text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words mb-3">
              {JSON.stringify(skillData.instructions.mcp_config_redacted, null, 2)}
            </pre>
            <p className="text-xs text-slate-400 dark:text-slate-500 py-2 px-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-l-3 border-amber-400 dark:border-amber-600">
              <strong className="text-slate-700 dark:text-slate-300">Note:</strong> The API key shown above is redacted for display.
              The downloaded package contains the full, working API key.
            </p>
          </div>

          {/* Installation Steps Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h3
              className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              Installation Steps
            </h3>
            <ol className="list-none p-0 m-0 space-y-0">
              {skillData.instructions.steps.map((step, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-3 py-3 ${
                    index < skillData.instructions.steps.length - 1
                      ? 'border-b border-slate-100 dark:border-slate-700'
                      : ''
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-1">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Intro Card (shown when no data and not loading) */}
      {!skillData && !loading && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 sm:p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6 text-primary-500">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2
            className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            Generate Your Claude Code Skill
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed mb-6">
            Create a skill package that lets Claude Code interact with your Memory Server.
            The package includes:
          </p>
          <ul className="list-none p-0 m-0 mb-6 text-left max-w-lg mx-auto space-y-2">
            <li className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">
              <strong className="text-primary-500 font-mono text-[13px]">SKILL.md</strong> - Instructions for Claude Code to use memory tools
            </li>
            <li className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">
              <strong className="text-primary-500 font-mono text-[13px]">mcp.json</strong> - Pre-configured MCP server connection with your API key
            </li>
          </ul>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Click the button above to generate your personalized skill package.
            Each package includes a unique API key bound to your account.
          </p>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 animate-float-up">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
