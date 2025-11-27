# Purpose

Implement simplified Cloudflare Zero Trust security with email authentication for UI and rotating API keys for MCP clients, leveraging Cloudflare's native rate limiting.

## Original Ask

We are working with cloudflare-zero-trust-security

So who is going to access it

Some handful of emails for UI workers

Some rotating API Keys for those clients who access MCP servers. We will start with that.

Those clients will always have full access, so no special RBAC needed, cloudflare backend provides their own rate limiting using wrangler.jsonc understand that

## Complexity and the reason behind it

**Complexity Score: 2/5**

**Reasoning:**
- **Simple access model** - No RBAC, no permissions, everyone gets full access
- **Cloudflare-managed authentication** - Access handles all UI auth automatically
- **Native rate limiting** - Using wrangler.jsonc configuration, no custom logic needed
- **Basic API key system** - Simple key validation with rotation capability
- **No complex audit logging** - Basic logging only (optional)
- **Clear patterns** - Well-documented Cloudflare + Hono patterns

**Why not 1/5:**
- Still requires JWT validation for defense-in-depth
- API key rotation mechanism needs implementation
- Database schema changes required
- Testing across multiple authentication flows

**Why not higher:**
- No permission system to build
- No complex authorization logic
- Rate limiting handled by Cloudflare
- No custom audit trail requirements

## Architectural changes required

### Current Architecture (No Authentication)
```
┌─────────────────────────────────────────┐
│         CLOUDFLARE EDGE                 │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  UI Worker (memory-server-ui)      │ │
│  │  ❌ NO AUTHENTICATION               │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  API Worker (memory-server)        │ │
│  │  /api/* and /mcp endpoints         │ │
│  │  ❌ NO AUTHENTICATION               │ │
│  └────────────────────────────────────┘ │
│                                          │
└─────────────────────────────────────────┘
```

### New Architecture (Simplified Zero Trust)
```
┌──────────────────────────────────────────────────────────┐
│            CLOUDFLARE ZERO TRUST LAYER                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  🔒 Cloudflare Access (Email Auth)                 │  │
│  │  - OTP to approved email addresses                 │  │
│  │  - JWT validation on worker (optional)             │  │
│  │  - Policy: Allow specific emails only              │  │
│  └──────────────────┬─────────────────────────────────┘  │
│                     │                                     │
│                     ▼                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │        UI Worker (memory-server-ui)                │  │
│  │        Protected by Cloudflare Access              │  │
│  │        Zero code changes required                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  🔒 Simple API Key Layer                           │  │
│  │  - Bearer token authentication                     │  │
│  │  - Database-backed key validation                  │  │
│  │  - No permissions (all keys = full access)         │  │
│  │  - Key rotation support                            │  │
│  └──────────────────┬─────────────────────────────────┘  │
│                     │                                     │
│                     ▼                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │     API Worker (memory-server)                     │  │
│  │     - apiKeyAuth middleware                        │  │
│  │     - Rate limiting via wrangler.jsonc             │  │
│  │     - All authenticated users = full access        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
└──────────────────────────────────────────────────────────┘

New Database Table:
┌──────────────────────┐
│      api_keys        │
├──────────────────────┤
│ - id (UUID)          │
│ - key_hash (SHA-256) │
│ - entity_name        │
│ - created_at         │
│ - last_used_at       │
│ - expires_at         │
│ - is_active          │
│ - notes              │
└──────────────────────┘
```

### Key Architectural Decisions

1. **Two-Tier Authentication (Simplified)**
   - **UI**: Cloudflare Access handles everything, zero code changes
   - **API/MCP**: Simple Bearer token validation against database

2. **No Authorization Layer**
   - All authenticated users = full access
   - No read/write/delete permissions
   - Simpler code, easier to maintain

3. **Native Rate Limiting**
   - Configure in `wrangler.jsonc`
   - No custom middleware required
   - Cloudflare handles all rate limit logic

4. **Minimal Database Schema**
   - Single `api_keys` table
   - No permissions column needed
   - Optional audit logging (can add later)

## Backend changes required

### Phase 1: Database Migration

**File: `migrations/0003_api_keys.sql`**

```sql
-- Create API keys table for simple authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,                 -- UUID
  key_hash TEXT UNIQUE NOT NULL,       -- SHA-256 hash of API key
  entity_name TEXT NOT NULL,           -- Human-readable: "Claude Desktop - Laptop"
  created_at INTEGER NOT NULL,         -- Unix timestamp
  last_used_at INTEGER,                -- Unix timestamp, updated on use
  expires_at INTEGER,                  -- Unix timestamp, NULL = never expires
  is_active INTEGER DEFAULT 1,         -- 0 = revoked, 1 = active
  notes TEXT                           -- Optional notes
);

-- Indexes for performance
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_entity ON api_keys(entity_name);
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at);

-- Example: Insert a test key (key: test_msk_abc123def456)
-- Hash generated with: echo -n "test_msk_abc123def456" | sha256sum
INSERT INTO api_keys (id, key_hash, entity_name, created_at, notes)
VALUES
  (
    lower(hex(randomblob(16))),
    '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    'Test Key',
    strftime('%s','now'),
    'Development test key - revoke in production'
  );
```

### Phase 2: Authentication Middleware

**File: `src/middleware/apiKeyAuth.ts` (new)**

```typescript
import { Context, Next } from 'hono';
import { createHash } from 'node:crypto';

interface ApiKey {
  id: string;
  key_hash: string;
  entity_name: string;
  is_active: number;
  last_used_at: number | null;
  expires_at: number | null;
}

interface ApiKeyContext {
  id: string;
  entityName: string;
}

/**
 * Simple API key authentication middleware
 * All authenticated users get full access (no permissions)
 * Expects: Authorization: Bearer <api-key>
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: 'Missing or invalid Authorization header',
        hint: 'Use: Authorization: Bearer <your-api-key>'
      },
      401
    );
  }

  const apiKey = authHeader.substring(7);

  // Basic validation
  if (apiKey.length < 32) {
    return c.json(
      {
        success: false,
        error: 'Invalid API key format'
      },
      401
    );
  }

  // Hash the API key
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Query database
  const db = c.env.DB;
  const result = await db
    .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1')
    .bind(keyHash)
    .first<ApiKey>();

  if (!result) {
    return c.json(
      {
        success: false,
        error: 'Invalid or inactive API key'
      },
      401
    );
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (result.expires_at && result.expires_at < now) {
    return c.json(
      {
        success: false,
        error: 'API key has expired'
      },
      401
    );
  }

  // Update last_used_at (fire-and-forget)
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .bind(now, result.id)
    .run()
    .catch(err => console.error('Failed to update last_used_at:', err));

  // Store auth context
  c.set('apiKey', {
    id: result.id,
    entityName: result.entity_name,
  } as ApiKeyContext);

  await next();
}

/**
 * Helper to get entity name from context
 */
export function getEntityName(c: Context): string {
  const apiKey = c.get('apiKey');
  return apiKey?.entityName || 'unknown';
}
```

### Phase 3: Rate Limiting Configuration

**File: `wrangler.jsonc` (update)**

```jsonc
{
  "name": "memory-server",
  "main": "src/index.ts",
  "compatibility_date": "2025-08-15",
  "compatibility_flags": ["nodejs_compat"],

  // Rate limiting configuration
  "limits": {
    "cpu_ms": 50
  },

  // Add rate limiting bindings
  "ratelimits": [
    {
      "name": "API_RATE_LIMITER",
      "namespace_id": "1001",
      "simple": {
        "limit": 1000,
        "period": 60
      }
    },
    {
      "name": "MCP_RATE_LIMITER",
      "namespace_id": "1002",
      "simple": {
        "limit": 500,
        "period": 60
      }
    }
  ],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "memory-db",
      "database_id": "8331bbd8-20cb-40b3-a12f-52851bc08227"
    }
  ],

  "kv_namespaces": [
    {
      "binding": "CACHE_KV",
      "id": "32ccd77eecf84aa08f3ded49aeb8ca69"
    }
  ],

  "vars": {
    "ENVIRONMENT": "development"
  },

  "browser": {
    "binding": "BROWSER"
  }
}
```

### Phase 4: Update Main Application

**File: `src/index.ts` (modifications)**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiKeyAuth, getEntityName } from './middleware/apiKeyAuth';

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('/*', cors({
  origin: [
    'https://memory-server-ui.dev-286.workers.dev',
    'http://localhost:5173',
    'http://localhost:8788',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 600,
  credentials: true,
}));

// Apply authentication to API and MCP routes
app.use('/api/*', apiKeyAuth);
app.use('/mcp', apiKeyAuth);

// Apply rate limiting to API routes
app.use('/api/*', async (c, next) => {
  const entityName = getEntityName(c);
  const { success } = await c.env.API_RATE_LIMITER.limit({
    key: entityName
  });

  if (!success) {
    return c.json({
      success: false,
      error: 'Rate limit exceeded'
    }, 429);
  }

  await next();
});

// Apply rate limiting to MCP routes
app.use('/mcp', async (c, next) => {
  const entityName = getEntityName(c);
  const { success } = await c.env.MCP_RATE_LIMITER.limit({
    key: entityName
  });

  if (!success) {
    return c.json({
      success: false,
      error: 'Rate limit exceeded'
    }, 429);
  }

  await next();
});

// All existing routes continue to work as-is
// No changes needed to handlers

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

export default app;
```

### Phase 5: TypeScript Types

**File: `types/index.ts` (update)**

```typescript
// Add to existing Env interface
export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  BROWSER: Fetcher;
  ENVIRONMENT: string;

  // Rate limiting bindings
  API_RATE_LIMITER: RateLimit;
  MCP_RATE_LIMITER: RateLimit;
}

// Rate limit interface
interface RateLimit {
  limit(options: { key: string }): Promise<{
    success: boolean;
  }>;
}
```

## Frontend changes required

### UI Worker: Zero Code Changes

The UI requires **no code changes** because:
- Cloudflare Access handles all authentication
- Requests automatically include JWT tokens
- UI continues to work exactly as before

### Optional: Defense-in-Depth JWT Verification

**File: `ui/src/worker.ts` (optional enhancement)**

```typescript
import { jwtVerify, createRemoteJWKSet } from 'jose';

interface CloudflareEnv {
  ASSETS: Fetcher;
  API_SERVICE: Fetcher;
  ENVIRONMENT: string;
  TEAM_DOMAIN?: string;  // e.g., "yourteam"
  POLICY_AUD?: string;   // Policy audience tag
}

async function verifyCloudflareAccess(
  request: Request,
  env: CloudflareEnv
): Promise<boolean> {
  // Skip in development
  if (env.ENVIRONMENT === 'development') {
    return true;
  }

  // Verify JWT if configured
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) {
    console.warn('Cloudflare Access not configured');
    return true;
  }

  const jwt = request.headers.get('CF-Access-JWT-Assertion');
  if (!jwt) {
    return false;
  }

  try {
    const teamDomain = `https://${env.TEAM_DOMAIN}.cloudflareaccess.com`;
    const JWKS = createRemoteJWKSet(
      new URL(`${teamDomain}/cdn-cgi/access/certs`)
    );

    const { payload } = await jwtVerify(jwt, JWKS, {
      issuer: teamDomain,
      audience: env.POLICY_AUD,
    });

    return !!payload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return false;
  }
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    // Optional JWT verification
    if (env.ENVIRONMENT === 'production') {
      const isAuthenticated = await verifyCloudflareAccess(request, env);
      if (!isAuthenticated) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Existing worker logic continues unchanged
    // ...
  }
};
```

**File: `ui/wrangler.jsonc` (update for JWT verification)**

```jsonc
{
  "name": "memory-server-ui",
  "main": "src/worker.ts",
  "compatibility_date": "2025-08-15",
  "compatibility_flags": [
    "nodejs_compat",
    "global_fetch_strictly_public"
  ],

  "services": [
    {
      "binding": "API_SERVICE",
      "service": "memory-server"
    }
  ],

  "assets": {
    "directory": "../dist/ui",
    "not_found_handling": "single-page-application",
    "binding": "ASSETS"
  },

  "vars": {
    "ENVIRONMENT": "production",
    "API_BASE_URL": "https://memory-server.dev-286.workers.dev",
    "TEAM_DOMAIN": "yourteam",
    "POLICY_AUD": "your-policy-aud-tag-here"
  },

  "env": {
    "development": {
      "vars": {
        "ENVIRONMENT": "development",
        "API_BASE_URL": "http://localhost:8787"
      }
    }
  }
}
```

### MCP Client Configuration

**File: `~/mcp-memory-proxy.js` (new)**

```javascript
#!/usr/bin/env node
const http = require('http');
const https = require('https');
const { URL } = require('url');

const API_URL = process.env.API_URL || 'https://memory-server.dev-286.workers.dev/mcp';
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('ERROR: API_KEY environment variable is required');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const targetUrl = new URL(API_URL);

  const headers = {
    ...req.headers,
    host: targetUrl.host,
    Authorization: `Bearer ${API_KEY}`,
  };

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 443,
    path: targetUrl.pathname + (req.url?.slice(1) || ''),
    method: req.method,
    headers: headers,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
});

const PORT = 8788;
server.listen(PORT, () => {
  console.log(`MCP proxy listening on http://localhost:${PORT}`);
  console.log(`Forwarding to: ${API_URL}`);
  console.log(`Using API key: ${API_KEY.substring(0, 12)}...`);
});
```

**File: `~/.config/Claude/claude_desktop_config.json`**

```json
{
  "mcpServers": {
    "memory-server": {
      "command": "node",
      "args": ["/path/to/mcp-memory-proxy.js"],
      "env": {
        "API_URL": "https://memory-server.dev-286.workers.dev/mcp",
        "API_KEY": "msk_your_api_key_here"
      }
    }
  }
}
```

## Cloudflare Zero Trust Configuration

### Step 1: Enable Zero Trust

1. Go to **Cloudflare Dashboard** → **Zero Trust**
2. Complete onboarding if first time
3. Note your team domain: `yourteam.cloudflareaccess.com`

### Step 2: Configure Email Authentication

1. Go to **Settings** → **Authentication** → **Login methods**
2. Enable **One-time PIN** (free, works for any email)
3. Optionally enable: Google, GitHub, Microsoft

### Step 3: Create Access Application for UI

1. **Access** → **Applications** → **Add application**
2. Choose **Self-hosted**
3. Configure:
   - **Name**: Memory Server UI
   - **Session Duration**: 24 hours
   - **Application Domain**: `memory-server-ui.dev-286.workers.dev`

### Step 4: Create Access Policy

1. **Policy name**: Approved Users
2. **Action**: Allow
3. **Include** → **Emails**:
   ```
   user1@example.com
   user2@example.com
   user3@example.com
   ```
4. Click **Save**

### Step 5: Test Authentication

```bash
# Should redirect to login
curl -I https://memory-server-ui.dev-286.workers.dev

# Open in browser, verify OTP flow
# Check for CF-Access-JWT-Assertion header after login
```

## Validation

### Pre-Deployment Testing

**1. Local Database Setup**

```bash
# Apply migration
wrangler d1 migrations apply memory-db --local

# Verify table created
wrangler d1 execute memory-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys'"

# Check test key exists
wrangler d1 execute memory-db --local --command "SELECT entity_name, is_active FROM api_keys"
```

**2. Test API Key Authentication**

```bash
# Start dev server
npm run dev

# Test with valid key
curl http://localhost:8787/api/memories \
  -H "Authorization: Bearer test_msk_abc123def456"
# Expected: 200 OK

# Test without key
curl http://localhost:8787/api/memories
# Expected: 401 Unauthorized

# Test with invalid key
curl http://localhost:8787/api/memories \
  -H "Authorization: Bearer invalid_key"
# Expected: 401 Unauthorized
```

**3. Test Rate Limiting**

```bash
# Generate 1001 requests
for i in {1..1001}; do
  curl -s http://localhost:8787/api/memories \
    -H "Authorization: Bearer test_msk_abc123def456" \
    > /dev/null
  echo "Request $i"
done
# Expected: First 1000 succeed, 1001 returns 429
```

### Production Deployment

**1. Deploy**

```bash
# Apply migration to production
wrangler d1 migrations apply memory-db --remote

# Generate production API key
node -e "console.log('msk_' + require('crypto').randomBytes(32).toString('hex'))"
# Output: msk_abc123... (save securely)

# Hash the key
node -e "const key='msk_abc123...'; console.log(require('crypto').createHash('sha256').update(key).digest('hex'))"
# Output: hash123...

# Insert into production database
wrangler d1 execute memory-db --remote --command \
  "INSERT INTO api_keys (id, key_hash, entity_name, created_at, notes) \
   VALUES (lower(hex(randomblob(16))), 'hash123...', 'Claude Desktop', strftime('%s','now'), 'Production key')"

# Deploy workers
npm run deploy
cd ui && npm run deploy
```

**2. Test Production**

```bash
# Test API with production key
curl https://memory-server.dev-286.workers.dev/api/memories \
  -H "Authorization: Bearer msk_abc123..."
# Expected: 200 OK

# Test UI (in browser)
# https://memory-server-ui.dev-286.workers.dev
# Should redirect to Cloudflare Access login
# Enter approved email, verify OTP, should access UI
```

**3. Test MCP Integration**

```bash
# Update Claude Desktop config with production key
# Restart Claude Desktop
# Try: "List my memories"
# Expected: Should work with authentication
```

### Success Criteria

- [ ] UI requires email authentication (approved emails only)
- [ ] Non-approved emails blocked by Cloudflare Access
- [ ] API requires Bearer token authentication
- [ ] Invalid/missing API keys return 401
- [ ] Rate limiting works (1000 req/min for API, 500 req/min for MCP)
- [ ] MCP client works with proxy + API key
- [ ] last_used_at updates on API key usage
- [ ] Type checking passes with no errors

## API Key Management

### Generate New Key

```bash
# 1. Generate key
node -e "console.log('msk_' + require('crypto').randomBytes(32).toString('hex'))"

# 2. Hash key
node -e "const key='YOUR_KEY'; console.log(require('crypto').createHash('sha256').update(key).digest('hex'))"

# 3. Insert into database
wrangler d1 execute memory-db --remote --command \
  "INSERT INTO api_keys (id, key_hash, entity_name, created_at, notes) \
   VALUES (lower(hex(randomblob(16))), 'YOUR_HASH', 'Entity Name', strftime('%s','now'), 'Notes')"
```

### Rotate Key

```bash
# 1. Generate new key (same as above)
# 2. Give new key to user
# 3. User confirms new key works
# 4. Deactivate old key
wrangler d1 execute memory-db --remote --command \
  "UPDATE api_keys SET is_active = 0 WHERE entity_name = 'Entity Name' AND is_active = 1"
```

### Revoke Key

```bash
wrangler d1 execute memory-db --remote --command \
  "UPDATE api_keys SET is_active = 0 WHERE id = 'key-id'"
```

### Check Usage

```bash
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name,
          datetime(created_at, 'unixepoch') as created,
          datetime(last_used_at, 'unixepoch') as last_used,
          is_active
   FROM api_keys
   ORDER BY last_used_at DESC"
```

## Implementation Timeline

### Week 1: Backend Implementation
- **Day 1**: Database migration, local testing
- **Day 2**: Authentication middleware implementation
- **Day 3**: Rate limiting configuration
- **Day 4**: Main app updates, integration testing
- **Day 5**: Buffer/documentation

### Week 2: Cloudflare Access & Deployment
- **Day 1**: Configure Cloudflare Zero Trust
- **Day 2**: Create Access application + policies
- **Day 3**: Generate production API keys
- **Day 4**: Deploy to production
- **Day 5**: Test all flows, fix issues

### Week 3: MCP Integration & Polish
- **Day 1**: Create MCP proxy script
- **Day 2**: Configure MCP clients
- **Day 3**: End-to-end testing
- **Day 4**: Documentation
- **Day 5**: Sign-off

## Cost Estimate

**Cloudflare Zero Trust: $0/month**
- Free tier: Up to 50 users
- Unlimited applications
- 7-day log retention

**Workers: Existing cost**
- No additional cost for auth logic

**Total: $0/month** (assuming < 50 users)

## Next Steps

1. **Review this simplified plan** - Confirm it matches your needs
2. **Approve list of emails** - Who needs UI access?
3. **Begin implementation** - Start with Week 1 tasks
4. **Generate API keys** - For MCP clients

Ready to start implementation!
