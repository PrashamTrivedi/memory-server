# Purpose

Implement self-hosted OAuth 2.1 for MCP endpoints where API Keys are used as credentials to obtain JWTs, enabling native Claude Desktop connector support.

## Original Ask

With API Keys as primary mechanism. How would we implement oauth 2. When OAuth comes, we should present the screen to enter the API key, if validated from Database, keep issuing JWTs.

## Complexity and the reason behind it

**Complexity Score: 2/5**

**Reasoning:**
- **Reuses existing infrastructure** - API keys table already exists
- **Self-contained** - No external OAuth provider needed
- **Simple JWT signing** - Use Cloudflare secret, no external JWKS
- **Minimal new endpoints** - Just OAuth flow endpoints + HTML form
- **Well-understood patterns** - Standard OAuth 2.1 with PKCE

**Why not 1/5:**
- Need to implement OAuth endpoints correctly
- JWT signing/verification logic
- HTML form for API key entry
- PKCE validation for security

## Architectural changes required

### Current Architecture
```
┌─────────────────────────────────────────┐
│  Memory Server                          │
│  ┌───────────────────────────────────┐  │
│  │ API Key Auth (Bearer msk_...)     │  │
│  │ - Validate against D1             │  │
│  └───────────────────────────────────┘  │
│                 ↓                        │
│  ┌───────────────────────────────────┐  │
│  │ /api/* and /mcp endpoints         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### New Architecture (Self-Hosted OAuth)
```
┌────────────────────────────────────────────────────────────────────────────┐
│  Memory Server (API + Authorization Server)                                │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  OAuth Discovery (no auth)                                           │  │
│  │  /.well-known/oauth-protected-resource  → points to self             │  │
│  │  /.well-known/oauth-authorization-server → our own endpoints         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  OAuth Flow Endpoints                                                │  │
│  │  GET  /oauth/authorize  → Show API key entry form                    │  │
│  │  POST /oauth/authorize  → Validate key, issue auth code              │  │
│  │  POST /oauth/token      → Exchange code for JWT                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Dual Auth Middleware                                                │  │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────────┐  │  │
│  │  │ API Key (msk_...)   │ OR │ JWT (self-signed)                   │  │  │
│  │  │ Direct D1 lookup    │    │ Verify with JWT_SECRET              │  │  │
│  │  └─────────────────────┘    └─────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Protected Resources                                                 │  │
│  │  /api/* - REST endpoints                                            │  │
│  │  /mcp   - MCP endpoint                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Storage                                                             │  │
│  │  ┌─────────────┐  ┌─────────────────┐                               │  │
│  │  │ D1: api_keys│  │ KV: oauth_codes │  (CACHE_KV with TTL)          │  │
│  │  │ (existing)  │  │ (5 min expiry)  │                               │  │
│  │  └─────────────┘  └─────────────────┘                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### OAuth Flow Sequence
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│Claude Desktop│     │Memory Server │     │    User      │
│  (MCP Client)│     │  (Self Auth) │     │  (Browser)   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. GET /mcp        │                    │
       │───────────────────>│                    │
       │                    │                    │
       │ 2. 401 Unauthorized│                    │
       │    WWW-Authenticate: Bearer             │
       │    resource="/.well-known/..."          │
       │<───────────────────│                    │
       │                    │                    │
       │ 3. GET /.well-known/oauth-protected-resource
       │───────────────────>│                    │
       │                    │                    │
       │ 4. { authorization_servers: ["https://memory-server.../"] }
       │<───────────────────│                    │
       │                    │                    │
       │ 5. GET /.well-known/oauth-authorization-server
       │───────────────────>│                    │
       │                    │                    │
       │ 6. { authorization_endpoint: "/oauth/authorize", ... }
       │<───────────────────│                    │
       │                    │                    │
       │ 7. Open browser: /oauth/authorize?      │
       │    client_id=...&redirect_uri=...&      │
       │    code_challenge=...&state=...         │
       │─────────────────────────────────────────>│
       │                    │                    │
       │                    │ 8. Render HTML form│
       │                    │    "Enter your API Key"
       │                    │───────────────────>│
       │                    │                    │
       │                    │ 9. User enters     │
       │                    │    msk_abc123...   │
       │                    │<───────────────────│
       │                    │                    │
       │                    │ 10. POST /oauth/authorize
       │                    │     Validate API key in D1
       │                    │     Generate auth code
       │                    │     Store code + code_challenge
       │                    │                    │
       │ 11. Redirect: redirect_uri?code=...&state=...
       │<────────────────────────────────────────│
       │                    │                    │
       │ 12. POST /oauth/token                   │
       │     code=...&code_verifier=...          │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ 13. Verify code_verifier
       │                    │     matches code_challenge
       │                    │     Sign JWT with secret
       │                    │                    │
       │ 14. { access_token: "eyJ...", expires_in: 3600 }
       │<───────────────────│                    │
       │                    │                    │
       │ 15. GET /mcp       │                    │
       │     Authorization: Bearer eyJ...        │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ 16. Verify JWT signature
       │                    │     with JWT_SECRET
       │                    │                    │
       │ 17. 200 OK (MCP response)               │
       │<───────────────────│                    │
```

## Backend changes required

### Phase 1: OAuth Discovery Endpoints

**New File: `src/oauth/metadata.ts`**

```typescript
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
}

export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}

export function getProtectedResourceMetadata(baseUrl: string): ProtectedResourceMetadata {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp:full"]
  };
}

export function getAuthorizationServerMetadata(baseUrl: string): AuthorizationServerMetadata {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"]
  };
}
```

### Phase 2: OAuth Flow Endpoints

**New File: `src/oauth/handlers.ts`**

```typescript
import { Context } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'node:crypto';

// GET /oauth/authorize - Show API key entry form
export async function showAuthorizeForm(c: Context) {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method } = c.req.query();

  // Validate required params
  if (!redirect_uri || !code_challenge || code_challenge_method !== 'S256') {
    return c.html(errorPage('Invalid OAuth request. Missing required parameters.'), 400);
  }

  return c.html(apiKeyEntryForm({ client_id, redirect_uri, state, code_challenge }));
}

// POST /oauth/authorize - Validate API key, issue auth code
export async function handleAuthorize(c: Context) {
  const body = await c.req.parseBody();
  const { api_key, client_id, redirect_uri, state, code_challenge } = body;

  // Validate API key against database
  const keyHash = createHash('sha256').update(api_key as string).digest('hex');
  const apiKeyRecord = await c.env.DB
    .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1')
    .bind(keyHash)
    .first();

  if (!apiKeyRecord) {
    return c.html(apiKeyEntryForm({
      client_id, redirect_uri, state, code_challenge,
      error: 'Invalid API key. Please check and try again.'
    }));
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (apiKeyRecord.expires_at && apiKeyRecord.expires_at < now) {
    return c.html(apiKeyEntryForm({
      client_id, redirect_uri, state, code_challenge,
      error: 'API key has expired.'
    }));
  }

  // Generate authorization code
  const authCode = randomBytes(32).toString('hex');

  // Store auth code in KV with 5-minute TTL (auto-expires)
  await c.env.CACHE_KV.put(
    `oauth_code:${authCode}`,
    JSON.stringify({
      code_challenge,
      api_key_id: apiKeyRecord.id,
      client_id: client_id || 'default',
      redirect_uri,
    }),
    { expirationTtl: 300 } // 5 minutes, auto-cleanup
  );

  // Redirect back with code
  const redirectUrl = new URL(redirect_uri as string);
  redirectUrl.searchParams.set('code', authCode);
  if (state) redirectUrl.searchParams.set('state', state as string);

  return c.redirect(redirectUrl.toString());
}

// POST /oauth/token - Exchange code for JWT
export async function handleToken(c: Context) {
  const body = await c.req.parseBody();
  const { code, code_verifier, grant_type } = body;

  if (grant_type !== 'authorization_code') {
    return c.json({ error: 'unsupported_grant_type' }, 400);
  }

  // Fetch auth code from KV
  const authCodeData = await c.env.CACHE_KV.get(`oauth_code:${code}`);

  if (!authCodeData) {
    // Code doesn't exist or already expired (KV auto-cleanup)
    return c.json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }, 400);
  }

  const authCode = JSON.parse(authCodeData);

  // Verify PKCE: SHA256(code_verifier) should match code_challenge
  const computedChallenge = createHash('sha256')
    .update(code_verifier as string)
    .digest('base64url');

  if (computedChallenge !== authCode.code_challenge) {
    return c.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
  }

  // Delete used code (prevent replay attacks)
  await c.env.CACHE_KV.delete(`oauth_code:${code}`);

  // Get API key info for JWT claims
  const apiKey = await c.env.DB
    .prepare('SELECT * FROM api_keys WHERE id = ?')
    .bind(authCode.api_key_id)
    .first();

  // Sign JWT
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const baseUrl = new URL(c.req.url).origin;

  const accessToken = await new SignJWT({
    sub: apiKey.id,
    entity: apiKey.entity_name,
    scope: 'mcp:full'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(baseUrl)
    .setAudience(baseUrl)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'mcp:full'
  });
}
```

**New File: `src/oauth/templates.ts`**

```typescript
interface FormParams {
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  code_challenge?: string;
  error?: string;
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

    ${error ? `<div class="error">${error}</div>` : ''}

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${client_id || ''}">
      <input type="hidden" name="redirect_uri" value="${redirect_uri || ''}">
      <input type="hidden" name="state" value="${state || ''}">
      <input type="hidden" name="code_challenge" value="${code_challenge || ''}">

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
  <p>${message}</p>
</body>
</html>`;
}
```

### Phase 3: Update Main Application

**Update `src/index.ts`**

```typescript
import { getProtectedResourceMetadata, getAuthorizationServerMetadata } from './oauth/metadata';
import { showAuthorizeForm, handleAuthorize, handleToken } from './oauth/handlers';
import { dualAuth } from './middleware/dualAuth';

// OAuth Discovery endpoints (no auth required)
app.get('/.well-known/oauth-protected-resource', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json(getProtectedResourceMetadata(baseUrl));
});

app.get('/.well-known/oauth-authorization-server', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json(getAuthorizationServerMetadata(baseUrl));
});

// OAuth flow endpoints (no auth required)
app.get('/oauth/authorize', showAuthorizeForm);
app.post('/oauth/authorize', handleAuthorize);
app.post('/oauth/token', handleToken);

// Protected routes use dual auth (API Key OR JWT)
app.use('/api/*', dualAuth);
app.use('/mcp', dualAuth);
```

### Phase 4: Dual Auth Middleware

**New File: `src/middleware/dualAuth.ts`**

```typescript
import { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import { apiKeyAuth } from './apiKeyAuth';

export async function dualAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorizedResponse(c);
  }

  const token = authHeader.substring(7);

  // API Key: starts with msk_
  if (token.startsWith('msk_')) {
    return apiKeyAuth(c, next);
  }

  // JWT: try to verify
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const baseUrl = new URL(c.req.url).origin;

    const { payload } = await jwtVerify(token, secret, {
      issuer: baseUrl,
      audience: baseUrl,
    });

    // Store auth context
    c.set('auth', {
      type: 'oauth',
      apiKeyId: payload.sub,
      entityName: payload.entity,
    });

    await next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return unauthorizedResponse(c);
  }
}

function unauthorizedResponse(c: Context) {
  const baseUrl = new URL(c.req.url).origin;

  return c.json(
    {
      success: false,
      error: 'Unauthorized',
      hint: 'Provide API key (Bearer msk_...) or OAuth token'
    },
    401,
    {
      'WWW-Authenticate': `Bearer resource="${baseUrl}/.well-known/oauth-protected-resource"`
    }
  );
}
```

### Phase 5: Environment Configuration

**Update `wrangler.jsonc`**

```jsonc
{
  "vars": {
    "ENVIRONMENT": "production"
  }
  // JWT_SECRET should be set via wrangler secret
}
```

**Set JWT Secret:**

```bash
# Generate a secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set as Cloudflare secret
wrangler secret put JWT_SECRET
# Paste the generated secret
```

**Update `types/index.ts`**

```typescript
export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  BROWSER: Fetcher;
  ENVIRONMENT: string;
  API_RATE_LIMITER: RateLimit;
  MCP_RATE_LIMITER: RateLimit;
  JWT_SECRET: string;  // Add this
}
```

## Frontend changes required

None. The OAuth flow uses a server-rendered HTML form. The existing UI continues using API Keys directly.

## Acceptance Criteria

1. **OAuth Discovery**
   - [ ] `/.well-known/oauth-protected-resource` returns metadata pointing to self
   - [ ] `/.well-known/oauth-authorization-server` returns our OAuth endpoints
   - [ ] 401 responses include `WWW-Authenticate` header

2. **OAuth Flow**
   - [ ] `/oauth/authorize` renders API key entry form
   - [ ] Valid API key generates auth code and redirects
   - [ ] Invalid API key shows error message
   - [ ] `/oauth/token` exchanges code for JWT with PKCE verification

3. **Dual Authentication**
   - [ ] API Keys (msk_*) continue to work unchanged
   - [ ] JWTs from OAuth flow are validated correctly
   - [ ] Invalid tokens return 401

4. **Claude Desktop Integration**
   - [ ] Native connector setup works via Settings > Connectors
   - [ ] User enters API key in browser form
   - [ ] MCP tools accessible after authentication

5. **Security**
   - [ ] PKCE (S256) enforced
   - [ ] Auth codes expire in 5 minutes
   - [ ] JWTs expire in 1 hour
   - [ ] JWT_SECRET stored securely

## Validation

### Local Testing

```bash
# 1. Set local JWT secret
export JWT_SECRET="dev-secret-for-testing-only"

# 2. Start dev server
npm run dev

# 3. Test OAuth discovery
curl http://localhost:8787/.well-known/oauth-protected-resource
# Expected: { "authorization_servers": ["http://localhost:8787"], ... }

curl http://localhost:8787/.well-known/oauth-authorization-server
# Expected: { "authorization_endpoint": "/oauth/authorize", ... }

# 4. Test 401 response
curl -I http://localhost:8787/mcp
# Expected: 401 with WWW-Authenticate header

# 5. Test API Key still works
curl http://localhost:8787/api/memories \
  -H "Authorization: Bearer msk_your_key_here"
# Expected: 200 OK

# 6. Manual OAuth flow test
# Open browser: http://localhost:8787/oauth/authorize?redirect_uri=http://localhost:3000/callback&code_challenge=test&code_challenge_method=S256&state=test123
# Enter API key, verify redirect with code
```

### Production Deployment

```bash
# 1. Set JWT secret
wrangler secret put JWT_SECRET

# 2. Deploy (no migration needed - uses existing KV)
npm run deploy

# 3. Test discovery
curl https://memory-server.dev-286.workers.dev/.well-known/oauth-protected-resource

# 4. Test in Claude Desktop
# Settings > Connectors > Add: https://memory-server.dev-286.workers.dev/mcp
# Enter API key when prompted
# Test: "List my memories"
```

### Test Matrix

| Scenario | Auth Method | Expected |
|----------|-------------|----------|
| No auth header | None | 401 + WWW-Authenticate |
| Valid API key (msk_...) | API Key | 200 OK |
| Invalid API key | API Key | 401 |
| Valid JWT | OAuth | 200 OK |
| Expired JWT | OAuth | 401 |
| Tampered JWT | OAuth | 401 |
| Wrong PKCE verifier | OAuth | 400 invalid_grant |

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/oauth/metadata.ts` | New | OAuth discovery metadata |
| `src/oauth/handlers.ts` | New | OAuth flow handlers |
| `src/oauth/templates.ts` | New | HTML form templates |
| `src/middleware/dualAuth.ts` | New | API Key + JWT auth |
| `src/index.ts` | Update | Add OAuth routes, use dualAuth |
| `types/index.ts` | Update | Add JWT_SECRET to Env |

**No database migration needed** - Auth codes stored in existing `CACHE_KV` with TTL auto-expiry.

## Dependencies

```bash
npm install jose  # JWT signing/verification
```
