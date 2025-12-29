# Purpose

Implement Claude Code skill download functionality that generates MCP-configured skill packages with bound API keys.

## Original Ask

Implement Claude Code skill download functionality for memory-server with these requirements:

### 1. Backend API Endpoints
- `POST /api/skills/generate` - Generate skill package with new skill-bound API key
- `GET /api/skills/download/:token` - Download the generated ZIP (temporary signed URL, 5 min expiry)

### 2. Skill Package Contents (ZIP)
Two files only:
- `SKILL.md` - MCP-only skill instructions (no auth handling in skill)
- `mcp.json` - MCP server config with API key in Authorization header

### 3. Key Management (Option A: Generate New Key)
- Create a new "skill-bound" API key when generating skill
- Key naming: `skill-{entity_name}-{timestamp}`
- Store `parent_key_id` to link skill key to the key used for authentication
- Add `key_type` column to api_keys table: 'standard' | 'skill-bound'

### 4. Response Structure
POST /api/skills/generate returns:
```json
{
  "success": true,
  "reused": false,
  "download_url": "/api/skills/download/{token}",
  "expires_in": 14400,
  "skill_key": {
    "id": "...",
    "entity_name": "skill-...",
    "created_at": ...
  },
  "instructions": {
    "mcp_config_redacted": { ... },
    "steps": [...]
  }
}
```
- `reused: true` when returning existing package within 4-hour window
- `expires_in`: seconds until download token expires (14400 = 4 hours)

### 5. Files to Create/Modify
- `src/handlers/skills.ts` - New handler for skill generation
- `src/skills/templates.ts` - SKILL.md template content
- `migrations/0004_skill_keys.sql` - Add key_type and parent_key_id columns
- `src/index.ts` - Add routes for /api/skills/*

### 6. SKILL.md Template Content
```markdown
---
name: memory-server
description: Personal knowledge base for storing code, architecture decisions,
  and research findings. Use when user says "remember this", "save to memory",
  "find in memory", "what did I learn about". Supports hierarchical tags.
---

# Memory Server

## Usage
- Save: "Remember this...", "Save to memory with tags..."
- Search: "What did I save about...", "Find my notes on..."

## Tools
- add_memory, find_memories, list_memories, get_memory, add_tags, delete_memory

## Tagging
Hierarchical format: parent>child (e.g., cloudflare>workers, mcp>transport)
```

### 7. Technical Details
- Use fflate for ZIP creation (lighter, faster than JSZip for Workers)
- Store ZIP in KV with **4-hour TTL** (reuse on repeated requests)
- Redact key for display: msk_abc123... → msk_****...****
- Routes should use existing dualAuth middleware

## Complexity and the reason behind it

**Complexity: 2/5**

Reasons:
- Straightforward CRUD-style endpoints following existing patterns in `apiKeys.ts`
- No complex business logic - mainly string templating and ZIP generation
- Database schema change is additive (new columns with defaults)
- Clear, well-defined deliverables with no ambiguity
- Existing middleware (dualAuth) can be reused
- KV storage pattern already used in the codebase

Lower complexity because:
- All infrastructure (D1, KV, auth middleware) already exists
- Similar handler patterns already established in codebase
- No frontend work required
- No external service integrations

## Architectural changes required

None required. This is an additive feature using existing:
- Hono routing patterns
- dualAuth middleware for authentication
- KV for temporary storage
- D1 for persistent storage

## Backend changes required

### 1. Database Migration (0004_skill_keys.sql)

Add two columns to existing `api_keys` table:
- `key_type TEXT DEFAULT 'standard'` - Values: 'standard' | 'skill-bound'
- `parent_key_id TEXT` - References parent key for skill-bound keys

```sql
ALTER TABLE api_keys ADD COLUMN key_type TEXT DEFAULT 'standard';
ALTER TABLE api_keys ADD COLUMN parent_key_id TEXT;
CREATE INDEX idx_api_keys_type ON api_keys(key_type);
CREATE INDEX idx_api_keys_parent ON api_keys(parent_key_id);
```

### 2. New Handler (src/handlers/skills.ts)

Two handler functions:

**generateSkillPackage(c: Context)**
- Validates authenticated user via context
- **Reuse Logic**: Check KV for existing skill package for this user
  - KV key format: `skill-pkg:{parent_key_id}`
  - If exists and not expired: return existing download URL (skip regeneration)
  - If not exists: generate new package
- Creates new skill-bound API key linked to auth key
- Generates SKILL.md from template with server URL
- Generates mcp.json with server URL and actual API key
- Creates ZIP using fflate (`zipSync`)
- Stores ZIP in KV with **4-hour TTL** (14400 seconds)
- Stores metadata in separate KV entry: `skill-meta:{parent_key_id}` with same TTL
  - Contains: download token, skill_key_id, created_at, expires_at
- Returns download URL with redacted key in instructions

**downloadSkillPackage(c: Context)**
- Extracts token from URL params
- Retrieves ZIP from KV (`skill-zip:{token}`)
- Returns ZIP as downloadable file with proper headers
- KV entry auto-expires after 4 hours, no cleanup needed

**KV Storage Structure:**
```
skill-meta:{parent_key_id} -> { token, skill_key_id, created_at, expires_at }  (TTL: 4h)
skill-zip:{token}          -> <binary ZIP data>                                 (TTL: 4h)
```

**Reuse Benefits:**
- Repeated generate calls within 4 hours return same package
- Same skill-bound key reused (no key proliferation)
- Reduces database writes and ZIP generation overhead

### 3. Template File (src/skills/templates.ts)

Export functions:
- `generateSkillMd(serverUrl: string): string` - Returns SKILL.md content
- `generateMcpJson(serverUrl: string, apiKey: string): object` - Returns mcp.json object
- `getInstallationSteps(): string[]` - Returns installation instruction steps

### 4. Route Registration (src/index.ts)

Add routes (note: import already exists but file doesn't):
```typescript
app.post('/api/skills/generate', skillHandlers.generateSkillPackage);
app.get('/api/skills/download/:token', skillHandlers.downloadSkillPackage);
```

### 5. Dependencies

Add fflate to package.json (preferred over JSZip for Workers):
```bash
npm install fflate
```

**Why fflate over JSZip:**
- Smaller bundle: ~11kB vs ~45kB
- Better performance: 50% faster compression
- No Node.js polyfills needed
- Works natively in Cloudflare Workers
- Use synchronous APIs: `zipSync`, `strToU8`

```typescript
import { zipSync, strToU8 } from 'fflate';

const zipData = zipSync({
  'memory-skill/SKILL.md': strToU8(skillMdContent),
  'memory-skill/mcp.json': strToU8(JSON.stringify(mcpJson, null, 2))
}, { level: 6 });
```

### 6. Helper Functions

**redactApiKey(key: string): string**
- Input: `msk_abc123def456...`
- Output: `msk_****...****`

**generateSkillKeyName(entityName: string): string**
- Input: entity name from auth context
- Output: `skill-{entityName}-{timestamp}`

## Frontend changes required

None required. API-only implementation.

## Validation

### Test Cases

#### 1. Generate Skill Package (Happy Path)
```bash
# Authenticate and generate skill
curl -X POST http://localhost:8787/api/skills/generate \
  -H "Authorization: Bearer msk_your_api_key" \
  -H "Content-Type: application/json"

# Expected response:
{
  "success": true,
  "reused": false,
  "download_url": "/api/skills/download/abc123-token",
  "expires_in": 14400,
  "skill_key": {
    "id": "...",
    "entity_name": "skill-YourEntity-1234567890",
    "created_at": 1234567890
  },
  "instructions": {
    "mcp_config_redacted": {
      "mcpServers": {
        "memory-server": {
          "transport": "streamable-http",
          "url": "http://localhost:8787/mcp",
          "headers": {
            "Authorization": "Bearer msk_****...****"
          }
        }
      }
    },
    "steps": [
      "Extract the downloaded ZIP",
      "Copy memory-skill folder to ~/.config/claude/skills/",
      "Merge mcp.json into ~/.config/claude/claude_desktop_config.json",
      "Restart Claude Code",
      "Test with: 'Save a test note to memory'"
    ]
  }
}
```

#### 2. Download Skill Package
```bash
# Download the ZIP using token from generate response
curl -O http://localhost:8787/api/skills/download/abc123-token

# Verify ZIP contents
unzip -l memory-skill.zip
# Expected:
# - memory-skill/SKILL.md
# - memory-skill/mcp.json
```

#### 3. Verify ZIP Contents
```bash
unzip memory-skill.zip
cat memory-skill/SKILL.md  # Should have server URL
cat memory-skill/mcp.json  # Should have ACTUAL key (not redacted)
```

#### 4. Verify Skill-Bound Key Created
```bash
# List API keys - should see new skill-bound key
curl http://localhost:8787/api/admin/keys \
  -H "Authorization: Bearer msk_your_api_key"

# Expected: key with entity_name starting with "skill-"
```

#### 5. Reuse Test (Same Package Within 4 Hours)
```bash
# Call generate twice
curl -X POST http://localhost:8787/api/skills/generate \
  -H "Authorization: Bearer msk_your_api_key"
# First call: creates new package

curl -X POST http://localhost:8787/api/skills/generate \
  -H "Authorization: Bearer msk_your_api_key"
# Second call: returns SAME download_url and skill_key (reused)
# Response includes: "reused": true
```

#### 6. Token Expiry Test
```bash
# Wait 4+ hours after generate
curl http://localhost:8787/api/skills/download/abc123-token
# Expected: 404 or error (token expired)
```

#### 7. Unauthorized Access
```bash
# No auth header
curl -X POST http://localhost:8787/api/skills/generate
# Expected: 401 Unauthorized
```

#### 8. Use Generated Key for MCP
```bash
# Extract key from mcp.json and use it
curl http://localhost:8787/mcp \
  -H "Authorization: Bearer msk_generated_skill_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
# Expected: Valid MCP response with tools list
```

### Database Verification
```sql
-- Check new columns exist
PRAGMA table_info(api_keys);
-- Should show key_type and parent_key_id columns

-- Check skill-bound keys
SELECT * FROM api_keys WHERE key_type = 'skill-bound';
-- Should show keys created via skill generation
```
