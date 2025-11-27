interface FormParams {
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  code_challenge?: string;
  error?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function apiKeyEntryForm(params: FormParams): string {
  const { client_id, redirect_uri, state, code_challenge, error } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memory Server - Authorization</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 420px;
      width: 100%;
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo svg { width: 48px; height: 48px; }
    h1 {
      text-align: center;
      color: #1a1a2e;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .subtitle {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-bottom: 32px;
    }
    .error {
      background: #fee;
      border: 1px solid #fcc;
      color: #c00;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    label {
      display: block;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      font-family: monospace;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #4a6cf7;
    }
    .hint {
      font-size: 12px;
      color: #888;
      margin-top: 8px;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #4a6cf7 0%, #6366f1 100%);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 24px;
      transition: transform 0.1s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(74, 108, 247, 0.4);
    }
    button:active { transform: translateY(0); }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="#4a6cf7" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    </div>
    <h1>Memory Server</h1>
    <p class="subtitle">Enter your API key to authorize access</p>

    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id || '')}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri || '')}">
      <input type="hidden" name="state" value="${escapeHtml(state || '')}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge || '')}">

      <label for="api_key">API Key</label>
      <input
        type="password"
        id="api_key"
        name="api_key"
        placeholder="msk_..."
        required
        autocomplete="off"
      >
      <p class="hint">Your API key starts with msk_ and is 68 characters long</p>

      <button type="submit">Authorize</button>
    </form>

    <p class="footer">
      This will grant access to your memories via MCP
    </p>
  </div>
</body>
</html>`;
}

export function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Error - Memory Server</title>
  <style>
    body { font-family: sans-serif; padding: 40px; text-align: center; }
    .error { color: #c00; }
  </style>
</head>
<body>
  <h1 class="error">Authorization Error</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}
