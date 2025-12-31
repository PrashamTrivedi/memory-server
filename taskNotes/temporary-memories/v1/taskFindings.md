# Purpose

Implement temporary memories with TTL-based lifecycle management, allowing memories to auto-expire or be promoted to permanent status based on access patterns.

## Original Ask

**Temporary Memories Feature**

Lifecycle: Memories can be created with an explicit temporary: true flag (exposed via both REST API and MCP tools). Temporary memories start with a 14-day TTL. When accessed within the TTL window, the memory's TTL extends to 28 days and an extension counter increments. After the second extension (extension_count = 2), the next access within TTL promotes the memory to permanent status. If a temporary memory is never accessed within its TTL window, it is hard-deleted by a scheduled cleanup job.

Implementation: TTL tracking uses Cloudflare KV with the key pattern temp_memory:{memory_id} storing {extension_count: N} as the value, with KV's native TTL set to the current expiry period (14 or 28 days). The cleanup job (Cron or Durable Object) queries the database for is_temporary=true memories, checks for missing KV entries (indicating expiry), and hard-deletes them. API/MCP responses do not expose temporary status--temporary memories are indistinguishable from permanent ones until they either expire and vanish, or get promoted. A manual promotion endpoint/tool allows users to convert temporary memories to permanent without waiting for the access-based promotion cycle.

**User Clarification:** No D1 schema changes needed. Temporary memories reside entirely in KV with the same JSON structure as D1 memories. When promoted, they get inserted into D1. Non-expired temporary memories surface alongside permanent ones in listings.

## Complexity and the reason behind it

**Complexity Score: 3/5**

Reasoning:
- **Simpler than original plan** - no database migration needed
- KV-only storage for temporary memories with TTL lifecycle
- Promotion = insert into D1 + delete from KV
- List/search operations need to merge KV temporary memories with D1 permanent ones
- New REST endpoint and MCP tool for manual promotion
- Scheduled cleanup is simpler - just KV, no D1 queries for cleanup

## Architectural changes required

### Storage Model

**Permanent Memories:** D1 database (existing)
**Temporary Memories:** KV with native TTL (new)

KV Key Pattern: `temp_memory:{memory_id}`
KV Value Structure:
```json
{
  "id": "uuid",
  "name": "Memory name",
  "content": "Memory content",
  "url": "optional url",
  "tags": ["tag1", "tag2"],
  "created_at": 1234567890,
  "updated_at": 1234567890,
  "extension_count": 0
}
```

### Lifecycle State Machine

```
CREATE MEMORY (temporary: true)
    |
    v
[KV: Put temp_memory:{id} with 14-day TTL, extension_count=0]

ACCESS MEMORY (GET temp_memory)
    |
    v
[KV: Get temp_memory:{id}]
    |
    +-- extension_count=0 --> [KV: Update TTL to 28 days, set count=1]
    |
    +-- extension_count=1 --> [KV: Update TTL to 28 days, set count=2]
    |
    +-- extension_count=2 --> [PROMOTE: Insert to D1, delete from KV]

LIST/FIND MEMORIES
    |
    v
[Query D1 for permanent memories]
    |
    v
[List KV temp_memory:* entries]
    |
    v
[Merge results, return unified list]

KV TTL EXPIRY (automatic)
    |
    v
[Memory vanishes - no cleanup needed]
```

### Key Insight

Since KV has native TTL, expired memories auto-delete. No cron job needed for cleanup! The only cron consideration would be for analytics/logging of expirations, but that's optional.

## Backend changes required

### 1. Type Definitions

**File:** `types/index.ts`

```typescript
// Update CreateMemoryRequest
export interface CreateMemoryRequest {
  name: string;
  content: string;
  url?: string;
  tags?: string[];
  temporary?: boolean;  // NEW
}

// NEW: Temporary memory stored in KV
export interface TemporaryMemory extends Memory {
  extension_count: number;
}

// Update Env
export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  TEMP_MEMORIES_KV: KVNamespace;  // NEW - dedicated namespace for temp memories
  // ... rest unchanged
}
```

### 2. Temporary Memory Service

**File:** `src/services/temporaryMemory.ts` (NEW)

```typescript
import type { Env, Memory, TemporaryMemory } from '../../types';

const TTL_14_DAYS = 14 * 24 * 60 * 60;  // 1,209,600 seconds
const TTL_28_DAYS = 28 * 24 * 60 * 60;  // 2,419,200 seconds
const TEMP_MEMORY_PREFIX = 'temp_memory:';

export class TemporaryMemoryService {

  /**
   * Create a new temporary memory in KV
   */
  static async create(env: Env, memory: Memory): Promise<TemporaryMemory> {
    const tempMemory: TemporaryMemory = {
      ...memory,
      extension_count: 0
    };

    await env.TEMP_MEMORIES_KV.put(
      `${TEMP_MEMORY_PREFIX}${memory.id}`,
      JSON.stringify(tempMemory),
      { expirationTtl: TTL_14_DAYS }
    );

    return tempMemory;
  }

  /**
   * Get a temporary memory by ID
   * Returns null if not found or expired
   */
  static async get(env: Env, id: string): Promise<TemporaryMemory | null> {
    const data = await env.TEMP_MEMORIES_KV.get(`${TEMP_MEMORY_PREFIX}${id}`);
    if (!data) return null;
    return JSON.parse(data) as TemporaryMemory;
  }

  /**
   * Handle memory access - extend TTL or promote to permanent
   * Returns { promoted: boolean, memory: Memory }
   */
  static async handleAccess(env: Env, id: string): Promise<{ promoted: boolean; memory: Memory | null }> {
    const tempMemory = await this.get(env, id);
    if (!tempMemory) {
      return { promoted: false, memory: null };
    }

    if (tempMemory.extension_count >= 2) {
      // Promote to permanent
      await this.promote(env, id);
      const { extension_count, ...memory } = tempMemory;
      return { promoted: true, memory };
    }

    // Extend TTL and increment counter
    const updated: TemporaryMemory = {
      ...tempMemory,
      extension_count: tempMemory.extension_count + 1,
      updated_at: Math.floor(Date.now() / 1000)
    };

    await env.TEMP_MEMORIES_KV.put(
      `${TEMP_MEMORY_PREFIX}${id}`,
      JSON.stringify(updated),
      { expirationTtl: TTL_28_DAYS }
    );

    const { extension_count, ...memory } = updated;
    return { promoted: false, memory };
  }

  /**
   * Promote a temporary memory to permanent (insert to D1, delete from KV)
   */
  static async promote(env: Env, id: string): Promise<Memory | null> {
    const tempMemory = await this.get(env, id);
    if (!tempMemory) return null;

    const { extension_count, ...memory } = tempMemory;
    const now = Math.floor(Date.now() / 1000);

    // Insert into D1
    await env.DB.prepare(`
      INSERT INTO memories (id, name, content, url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(memory.id, memory.name, memory.content, memory.url || null, memory.created_at, now).run();

    // Insert tags if any
    if (memory.tags && memory.tags.length > 0) {
      for (const tagName of memory.tags) {
        // Get or create tag
        let tag = await env.DB.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first<{ id: number }>();
        if (!tag) {
          const result = await env.DB.prepare('INSERT INTO tags (name) VALUES (?)').bind(tagName).run();
          tag = { id: result.meta.last_row_id as number };
        }
        // Link tag to memory
        await env.DB.prepare('INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)').bind(memory.id, tag.id).run();
      }
    }

    // Delete from KV
    await env.TEMP_MEMORIES_KV.delete(`${TEMP_MEMORY_PREFIX}${id}`);

    return { ...memory, updated_at: now };
  }

  /**
   * List all temporary memories (for merging with D1 results)
   */
  static async listAll(env: Env): Promise<Memory[]> {
    const list = await env.TEMP_MEMORIES_KV.list({ prefix: TEMP_MEMORY_PREFIX });
    const memories: Memory[] = [];

    for (const key of list.keys) {
      const data = await env.TEMP_MEMORIES_KV.get(key.name);
      if (data) {
        const tempMemory: TemporaryMemory = JSON.parse(data);
        const { extension_count, ...memory } = tempMemory;
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Check if a memory exists as temporary
   */
  static async exists(env: Env, id: string): Promise<boolean> {
    const data = await env.TEMP_MEMORIES_KV.get(`${TEMP_MEMORY_PREFIX}${id}`);
    return data !== null;
  }

  /**
   * Delete a temporary memory
   */
  static async delete(env: Env, id: string): Promise<boolean> {
    const exists = await this.exists(env, id);
    if (!exists) return false;
    await env.TEMP_MEMORIES_KV.delete(`${TEMP_MEMORY_PREFIX}${id}`);
    return true;
  }

  /**
   * Update a temporary memory (reset TTL on update)
   */
  static async update(env: Env, id: string, updates: Partial<Memory>): Promise<Memory | null> {
    const tempMemory = await this.get(env, id);
    if (!tempMemory) return null;

    const now = Math.floor(Date.now() / 1000);
    const updated: TemporaryMemory = {
      ...tempMemory,
      ...updates,
      id: tempMemory.id, // Preserve ID
      updated_at: now
    };

    // Determine TTL based on extension count
    const ttl = tempMemory.extension_count === 0 ? TTL_14_DAYS : TTL_28_DAYS;

    await env.TEMP_MEMORIES_KV.put(
      `${TEMP_MEMORY_PREFIX}${id}`,
      JSON.stringify(updated),
      { expirationTtl: ttl }
    );

    const { extension_count, ...memory } = updated;
    return memory;
  }
}
```

### 3. Memory Handler Updates

**File:** `src/handlers/memory.ts`

**createMemory** - Add temporary support:
```typescript
export async function createMemory(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<CreateMemoryRequest>();

  // ... existing validation ...

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const memory: Memory = {
    id,
    name: body.name,
    content,
    url: body.url,
    tags: body.tags || [],
    created_at: now,
    updated_at: now
  };

  if (body.temporary) {
    // Create in KV with TTL
    await TemporaryMemoryService.create(c.env, memory);
  } else {
    // Create in D1 (existing logic)
    await c.env.DB.prepare(`...`).bind(...).run();
    // ... tag handling ...
  }

  // Response (same for both)
  return sendFormattedResponse(c, markdown, jsonData);
}
```

**getMemory** - Check both KV and D1:
```typescript
export async function getMemory(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');

  // First check temporary memories in KV
  const tempResult = await TemporaryMemoryService.handleAccess(c.env, id);
  if (tempResult.memory) {
    // Return memory (may have been promoted)
    return sendFormattedResponse(c, formatMemory(tempResult.memory), { success: true, data: tempResult.memory });
  }

  // Fall back to D1 (permanent memories)
  const memory = await getMemoryById(c.env.DB, id);
  if (!memory) {
    throw new MemoryNotFoundError(id);
  }

  return sendFormattedResponse(c, formatMemory(memory), { success: true, data: memory });
}
```

**listMemories** - Merge KV and D1:
```typescript
export async function listMemories(c: Context<{ Bindings: Env }>) {
  // Get permanent memories from D1
  const d1Memories = await getMemoriesFromD1(c.env);

  // Get temporary memories from KV
  const tempMemories = await TemporaryMemoryService.listAll(c.env);

  // Merge and sort by updated_at desc
  const allMemories = [...d1Memories, ...tempMemories]
    .sort((a, b) => b.updated_at - a.updated_at);

  // Apply pagination
  const { limit = 50, offset = 0 } = c.req.query();
  const paginated = allMemories.slice(offset, offset + limit);

  return sendFormattedResponse(c, formatMemories(paginated), { success: true, data: paginated });
}
```

**deleteMemory** - Check both KV and D1:
```typescript
export async function deleteMemory(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');

  // Try to delete from temporary first
  const deletedTemp = await TemporaryMemoryService.delete(c.env, id);
  if (deletedTemp) {
    return sendFormattedResponse(c, 'Memory deleted', { success: true });
  }

  // Fall back to D1
  // ... existing delete logic ...
}
```

**NEW: promoteMemory**:
```typescript
export async function promoteMemory(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');

  // Check if exists as temporary
  const exists = await TemporaryMemoryService.exists(c.env, id);
  if (!exists) {
    // Check if already permanent
    const permanent = await getMemoryById(c.env.DB, id);
    if (permanent) {
      return c.json({ success: false, error: 'Memory is already permanent' }, 400);
    }
    throw new MemoryNotFoundError(id);
  }

  // Promote
  const memory = await TemporaryMemoryService.promote(c.env, id);
  return sendFormattedResponse(c, `Memory promoted to permanent`, { success: true, data: memory });
}
```

### 4. Route Registration

**File:** `src/index.ts`

```typescript
// Add promotion endpoint
app.post('/api/memories/:id/promote', memoryHandlers.promoteMemory);
```

### 5. Wrangler Configuration

**File:** `wrangler.jsonc`

Add new KV namespace:
```jsonc
"kv_namespaces": [
  {
    "binding": "CACHE_KV",
    "id": "32ccd77eecf84aa08f3ded49aeb8ca69"
  },
  {
    "binding": "TEMP_MEMORIES_KV",
    "id": "<new-kv-namespace-id>"
  }
]
```

### 6. MCP Tool Updates

**File:** `src/mcp/tools/memory.ts`

Update `addMemoryTool` schema to include `temporary` parameter.
Update `handleAddMemory` to create temporary memory in KV when `temporary: true`.

Add new `promoteMemoryTool` and `handlePromoteMemory`.

Update `handleGetMemory` to check KV first, then D1.
Update `handleListMemories` to merge KV and D1 results.
Update `handleFindMemories` to search both KV and D1.
Update `handleDeleteMemory` to check KV first, then D1.

### 7. MCP Server Registration

**File:** `src/mcp/server.ts`

Register `promote_memory` tool.

## Frontend changes required

None required. Temporary memories appear identical to permanent ones in API responses.

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `types/index.ts` | MODIFY | Add `temporary` to CreateMemoryRequest, add TemporaryMemory type, add TEMP_MEMORIES_KV to Env |
| `src/services/temporaryMemory.ts` | NEW | TemporaryMemoryService with create, get, handleAccess, promote, listAll, delete, update |
| `wrangler.jsonc` | MODIFY | Add TEMP_MEMORIES_KV namespace binding |
| `src/handlers/memory.ts` | MODIFY | Update create, get, list, delete handlers + add promoteMemory |
| `src/index.ts` | MODIFY | Add /api/memories/:id/promote route |
| `src/mcp/tools/memory.ts` | MODIFY | Update add_memory, get_memory, list_memories, find_memories, delete_memory + add promote_memory |
| `src/mcp/server.ts` | MODIFY | Register promote_memory tool |

## Acceptance Criteria

1. **Creation**
   - POST /api/memories with `temporary: true` creates memory in KV with 14-day TTL
   - MCP add_memory with `temporary: true` creates memory in KV
   - Default (no flag) creates permanent memory in D1

2. **Access/Extension**
   - GET temporary memory with extension_count=0 extends TTL to 28 days, count=1
   - GET with count=1 extends TTL to 28 days, count=2
   - GET with count=2 promotes to D1, deletes from KV

3. **Listing/Search**
   - List returns merged results from D1 + KV
   - Find/search works across both D1 and KV
   - Results sorted by updated_at

4. **Hidden Status**
   - API responses never include extension_count
   - Temporary memories indistinguishable from permanent

5. **Manual Promotion**
   - POST /api/memories/:id/promote promotes KV -> D1
   - MCP promote_memory tool does the same
   - Error if already permanent or not found

6. **Deletion**
   - DELETE works for both temporary (KV) and permanent (D1)

7. **Auto-Expiry**
   - KV TTL handles expiry automatically
   - No cron job needed for cleanup

## Implementation Order

1. Update `types/index.ts`
2. Create `src/services/temporaryMemory.ts`
3. Update `wrangler.jsonc` (add KV namespace)
4. Update `src/handlers/memory.ts`
5. Update `src/index.ts` (add route)
6. Update `src/mcp/tools/memory.ts`
7. Update `src/mcp/server.ts`
8. Create KV namespace in Cloudflare dashboard
9. Test locally with wrangler dev
10. Deploy
