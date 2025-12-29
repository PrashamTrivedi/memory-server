import { useState } from 'react';
import { api } from '../api/client';
import './SkillDownload.css';

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
    <div className="skill-download-page">
      <div className="skill-download-header">
        <div className="skill-download-header-top">
          <h1>Claude Code Skill</h1>
          <button
            onClick={generateSkillPackage}
            className="generate-skill-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
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

        <p className="skill-download-description">
          Generate a pre-configured Claude Code skill package with MCP integration.
          The package includes a SKILL.md file and mcp.json with your API key for seamless setup.
        </p>
      </div>

      {error && (
        <div className="skill-download-error">
          {error}
        </div>
      )}

      {skillData && (
        <div className="skill-result">
          <div className="skill-result-header">
            <h2>
              Skill Package Ready
              {skillData.reused && (
                <span className="reused-badge">Reused</span>
              )}
            </h2>
            <div className="expiration-timer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Expires in {formatExpiration(skillData.expires_in)}
            </div>
          </div>

          {/* Download Section */}
          <div className="download-section">
            <button onClick={downloadPackage} className="download-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download memory-skill.zip
            </button>
          </div>

          {/* Skill Key Info */}
          <div className="skill-info-card">
            <h3>Skill Key Details</h3>
            <div className="skill-info-grid">
              <div className="skill-info-item">
                <span className="skill-info-label">Key ID</span>
                <span className="skill-info-value mono">{skillData.skill_key.id}</span>
              </div>
              <div className="skill-info-item">
                <span className="skill-info-label">Entity Name</span>
                <span className="skill-info-value">{skillData.skill_key.entity_name}</span>
              </div>
              <div className="skill-info-item">
                <span className="skill-info-label">Created</span>
                <span className="skill-info-value">{formatDate(skillData.skill_key.created_at)}</span>
              </div>
            </div>
          </div>

          {/* MCP Configuration */}
          <div className="mcp-config-card">
            <div className="mcp-config-header">
              <h3>MCP Configuration</h3>
              <button
                onClick={() => copyToClipboard(JSON.stringify(skillData.instructions.mcp_config_redacted, null, 2))}
                className="copy-config-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Copy
              </button>
            </div>
            <pre className="mcp-config-code">
              {JSON.stringify(skillData.instructions.mcp_config_redacted, null, 2)}
            </pre>
            <p className="mcp-config-note">
              <strong>Note:</strong> The API key shown above is redacted for display.
              The downloaded package contains the full, working API key.
            </p>
          </div>

          {/* Installation Steps */}
          <div className="installation-steps-card">
            <h3>Installation Steps</h3>
            <ol className="installation-steps">
              {skillData.instructions.steps.map((step, index) => (
                <li key={index} className="installation-step">
                  <span className="step-number">{index + 1}</span>
                  <span className="step-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {!skillData && !loading && (
        <div className="skill-intro-card">
          <div className="skill-intro-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Generate Your Claude Code Skill</h2>
          <p>
            Create a skill package that lets Claude Code interact with your Memory Server.
            The package includes:
          </p>
          <ul className="skill-features">
            <li>
              <strong>SKILL.md</strong> - Instructions for Claude Code to use memory tools
            </li>
            <li>
              <strong>mcp.json</strong> - Pre-configured MCP server connection with your API key
            </li>
          </ul>
          <p className="skill-note">
            Click the button above to generate your personalized skill package.
            Each package includes a unique API key bound to your account.
          </p>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
