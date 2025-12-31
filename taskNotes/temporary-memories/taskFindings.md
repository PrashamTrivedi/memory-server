# Purpose

Upgrade temporary memories from extension_count-based lifecycle to a stage-based lifecycle with access tracking and dedicated review/rescue interface.

## Original Ask

**Temporary Memories with Review & Rescue Model** - Update existing temporary memories implementation with:

### New Requirements (different from current implementation):

1. **Stage-Based Lifecycle** (replaces current extension_count system):
   - Stage 1: 14-day TTL, requires **5 accesses** to advance to Stage 2
   - Stage 2: 28-day TTL, requires **10 more accesses** (total 15) to auto-promote to permanent D1 storage
   - Track `access_count` (not just extension_count), `stage` (1 or 2), and `last_accessed` timestamp

2. **First-Class Citizenship** (keep existing behavior):
   - Temporary memories appear identical to permanent ones in all standard operations (list, search, get, stats)
   - Users shouldn't need to know underlying storage status during normal use
   - The `access_count`, `stage`, `last_accessed` fields are HIDDEN from normal API responses

3. **Review & Rescue Interface** (NEW - not yet implemented):
   - REST endpoint: `GET /api/memories/temporary` - lists ONLY temporary memories with full lifecycle metadata
   - MCP tool: `review_temporary_memories` - same functionality
   - Response includes lifecycle metadata:
     - `days_until_expiry`: calculated from KV TTL
     - `access_count`: total number of accesses
     - `stage`: 1 or 2
     - `last_accessed`: timestamp of last access
   - Users can use existing `promote` endpoint/tool to save memories before expiry
   - This interface is SEPARATE from normal list/search - dedicated for maintenance

## Complexity and the reason behind it

**Complexity Score: 3/5**

Reasoning:
- Modifying existing working implementation (not greenfield)
- New lifecycle model with 2 stages and access counting
- Need to calculate `days_until_expiry` from KV metadata
- New REST endpoint and MCP tool for review interface
- Must maintain backward compatibility with normal operations
- Testing requires simulating access patterns

**Note:** No migration needed - all current memories are permanent (in D1). No existing temporary memories in KV use the old `extension_count` format.

## Architectural changes required

### Storage Model Update

The KV value structure needs to change from:
```json
// Current (v1)
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

To:
```json
// New (v2)
{
  "id": "uuid",
  "name": "Memory name",
  "content": "Memory content",
  "url": "optional url",
  "tags": ["tag1", "tag2"],
  "created_at": 1234567890,
  "updated_at": 1234567890,
  "access_count": 0,
  "stage": 1,
  "last_accessed": 1234567890
}
```

### Lifecycle State Machine (Updated)

```
CREATE MEMORY (temporary: true)
    |
    v
[KV: Put temp_memory:{id} with 14-day TTL, access_count=0, stage=1, last_accessed=now]

ACCESS MEMORY (GET temp_memory)
    |
    v
[KV: Get temp_memory:{id}]
    |
    +-- stage=1, access_count < 5 --> [KV: Increment access_count, update last_accessed, reset TTL to 14 days]
    |
    +-- stage=1, access_count >= 5 --> [KV: Set stage=2, reset access_count to 5, set TTL to 28 days]
    |
    +-- stage=2, access_count < 15 --> [KV: Increment access_count, update last_accessed, reset TTL to 28 days]
    |
    +-- stage=2, access_count >= 15 --> [PROMOTE: Insert to D1, delete from KV]

LIST/FIND MEMORIES (standard operations)
    |
    v
[Query D1 for permanent memories]
    |
    v
[List KV temp_memory:* entries]
    |
    v
[Merge results, STRIP lifecycle metadata, return unified list]

REVIEW TEMPORARY MEMORIES (new dedicated endpoint)
    |
    v
[List KV temp_memory:* entries with metadata]
    |
    v
[Calculate days_until_expiry from KV TTL metadata]
    |
    v
[Return with full lifecycle metadata visible]

KV TTL EXPIRY (automatic)
    |
    v
[Memory vanishes - no cleanup needed]
```

### Key Behavior Notes

1. **Access Counting**: Every `get_memory` or `GET /api/memories/:id` on a temporary memory increments `access_count` and resets the TTL
2. **Stage Transition**: At 5 accesses, stage advances from 1 to 2, TTL changes from 14 to 28 days
3. **Auto-Promotion**: At 15 accesses (stage 2), memory auto-promotes to D1
4. **TTL Reset**: Each access resets the TTL to full value (14 or 28 days depending on stage)
5. **Review Interface**: Dedicated for maintenance, shows lifecycle data hidden elsewhere

## Backend changes required

### 1. Type Definitions Update

**File:** `types/index.ts`

```typescript
// Update TemporaryMemory interface
export interface TemporaryMemory extends Memory {
  access_count: number;  // Replaces extension_count
  stage: 1 | 2;          // NEW: Stage in lifecycle
  last_accessed: number; // NEW: Timestamp of last access
}

// NEW: Type for review endpoint response
export interface TemporaryMemoryWithMetadata {
  id: string;
  name: string;
  content: string;
  url?: string;
  tags: string[];
  created_at: number;
  updated_at: number;
  // Lifecycle metadata (visible in review interface only)
  access_count: number;
  stage: 1 | 2;
  last_accessed: number;
  days_until_expiry: number;  // Calculated field
}
```

### 2. TemporaryMemoryService Update

**File:** `src/services/temporaryMemory.ts`

Major changes:
- Replace `extension_count` with `access_count`, `stage`, `last_accessed`
- Update lifecycle thresholds (5 accesses -> stage 2, 15 accesses -> promote)
- Add `listAllWithMetadata()` method for review endpoint
- Add TTL calculation for `days_until_expiry`

```typescript
// Constants
const TTL_14_DAYS = 14 * 24 * 60 * 60;  // Stage 1: 14 days
const TTL_28_DAYS = 28 * 24 * 60 * 60;  // Stage 2: 28 days
const STAGE_1_THRESHOLD = 5;   // Accesses needed to advance to Stage 2
const STAGE_2_THRESHOLD = 15;  // Total accesses needed for auto-promotion

// Updated create method
static async create(env: Env, memory: Memory): Promise<TemporaryMemory> {
  const now = Math.floor(Date.now() / 1000);
  const tempMemory: TemporaryMemory = {
    ...memory,
    access_count: 0,
    stage: 1,
    last_accessed: now
  };
  // ... put with 14-day TTL
}

// Updated handleAccess method
static async handleAccess(env: Env, id: string): Promise<{ promoted: boolean; memory: Memory | null }> {
  const tempMemory = await this.get(env, id);
  if (!tempMemory) return { promoted: false, memory: null };

  const now = Math.floor(Date.now() / 1000);
  const newAccessCount = tempMemory.access_count + 1;

  // Check for auto-promotion (stage 2 with 15+ accesses)
  if (tempMemory.stage === 2 && newAccessCount >= STAGE_2_THRESHOLD) {
    const promoted = await this.promote(env, id);
    return { promoted: true, memory: promoted };
  }

  // Check for stage advancement (stage 1 with 5+ accesses)
  let newStage = tempMemory.stage;
  let newTtl = tempMemory.stage === 1 ? TTL_14_DAYS : TTL_28_DAYS;

  if (tempMemory.stage === 1 && newAccessCount >= STAGE_1_THRESHOLD) {
    newStage = 2;
    newTtl = TTL_28_DAYS;
  }

  // Update with new access info
  const updated: TemporaryMemory = {
    ...tempMemory,
    access_count: newAccessCount,
    stage: newStage,
    last_accessed: now,
    updated_at: now
  };

  await env.TEMP_MEMORIES_KV.put(
    `${TEMP_MEMORY_PREFIX}${id}`,
    JSON.stringify(updated),
    { expirationTtl: newTtl }
  );

  // Return memory without lifecycle metadata
  const { access_count, stage, last_accessed, ...memory } = updated;
  return { promoted: false, memory };
}

// NEW: List with metadata for review endpoint
static async listAllWithMetadata(env: Env): Promise<TemporaryMemoryWithMetadata[]> {
  const list = await env.TEMP_MEMORIES_KV.list({ prefix: TEMP_MEMORY_PREFIX });
  const memories: TemporaryMemoryWithMetadata[] = [];

  for (const key of list.keys) {
    // Get with metadata to access expiration
    const result = await env.TEMP_MEMORIES_KV.getWithMetadata(key.name);
    if (result.value) {
      const tempMemory: TemporaryMemory = JSON.parse(result.value as string);

      // Calculate days until expiry
      // Note: KV doesn't expose exact expiration, estimate from stage and last_accessed
      const ttlSeconds = tempMemory.stage === 1 ? TTL_14_DAYS : TTL_28_DAYS;
      const expiresAt = tempMemory.last_accessed + ttlSeconds;
      const now = Math.floor(Date.now() / 1000);
      const secondsUntilExpiry = Math.max(0, expiresAt - now);
      const daysUntilExpiry = Math.ceil(secondsUntilExpiry / (24 * 60 * 60));

      memories.push({
        id: tempMemory.id,
        name: tempMemory.name,
        content: tempMemory.content,
        url: tempMemory.url,
        tags: tempMemory.tags,
        created_at: tempMemory.created_at,
        updated_at: tempMemory.updated_at,
        access_count: tempMemory.access_count,
        stage: tempMemory.stage,
        last_accessed: tempMemory.last_accessed,
        days_until_expiry: daysUntilExpiry
      });
    }
  }

  // Sort by days_until_expiry (ascending - most urgent first)
  return memories.sort((a, b) => a.days_until_expiry - b.days_until_expiry);
}
```

### 3. Memory Handler - Add Review Endpoint

**File:** `src/handlers/memory.ts`

```typescript
/**
 * List temporary memories with lifecycle metadata
 * GET /api/memories/temporary
 */
export async function listTemporaryMemories(c: Context<{ Bindings: Env }>) {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    // Get temporary memories with full metadata
    const allTemp = await TemporaryMemoryService.listAllWithMetadata(c.env);

    const total = allTemp.length;
    const paginated = allTemp.slice(offset, offset + limit);

    const pagination = {
      total,
      limit,
      offset,
      has_more: offset + limit < total
    };

    // Format response with lifecycle metadata visible
    const markdown = formatTemporaryMemoriesAsMarkdown(paginated, pagination);
    const jsonData = {
      success: true,
      data: {
        memories: paginated,
        pagination
      }
    };

    return sendFormattedResponse(c, markdown, jsonData);
  } catch (error) {
    return handleMemoryError(error, c);
  }
}
```

### 4. Route Registration

**File:** `src/index.ts`

```typescript
// Add BEFORE the :id route to avoid conflicts
app.get('/api/memories/temporary', memoryHandlers.listTemporaryMemories);
```

### 5. MCP Tool - Review Temporary Memories

**File:** `src/mcp/tools/memory.ts`

Add new tool:
```typescript
export const reviewTemporaryMemoriesTool: Tool = {
  name: 'review_temporary_memories',
  description: 'List temporary memories with their lifecycle metadata for review and maintenance',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of memories to return (max 100)',
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Number of memories to skip',
        default: 0,
      },
    },
  },
};

export async function handleReviewTemporaryMemories(env: Env, args: any): Promise<any> {
  const limit = Math.min(args.limit || 50, 100);
  const offset = args.offset || 0;

  const allTemp = await TemporaryMemoryService.listAllWithMetadata(env);
  const total = allTemp.length;
  const paginated = allTemp.slice(offset, offset + limit);

  const pagination = {
    total,
    limit,
    offset,
    has_more: offset + limit < total
  };

  const markdown = formatTemporaryMemoriesAsMarkdown(paginated, pagination);
  const structuredData = {
    success: true,
    data: {
      memories: paginated,
      pagination
    }
  };

  return createDualFormatResponse(markdown, structuredData);
}
```

### 6. MCP Server Registration

**File:** `src/mcp/server.ts`

```typescript
server.tool(
  'review_temporary_memories',
  'List temporary memories with their lifecycle metadata for review and maintenance',
  {
    limit: z.number().optional().describe('Maximum number of memories to return'),
    offset: z.number().optional().describe('Number of memories to skip'),
  },
  async (args) => {
    return await handleReviewTemporaryMemories(env, args)
  }
)
```

### 7. Formatter - Add Temporary Memories Formatter

**File:** `src/mcp/utils/formatters.ts`

```typescript
/**
 * Format temporary memories list with lifecycle metadata
 */
export function formatTemporaryMemoriesAsMarkdown(
  memories: TemporaryMemoryWithMetadata[],
  pagination: PaginationInfo
): string {
  const { total, offset, has_more } = pagination;

  let markdown = `# Temporary Memories Review

**Total**: ${total} temporary memories
**Purpose**: Review and rescue memories before expiry

`;

  if (memories.length === 0) {
    markdown += `No temporary memories found.\n`;
    return markdown;
  }

  memories.forEach((memory, index) => {
    const position = offset + index + 1;
    const urgency = memory.days_until_expiry <= 3 ? '🔴 URGENT' :
                    memory.days_until_expiry <= 7 ? '🟡 Soon' : '🟢 Safe';

    markdown += `## ${position}. ${memory.name}

${truncateContent(memory.content, 150)}

### Lifecycle Status
- **Stage**: ${memory.stage}/2
- **Access Count**: ${memory.access_count}/${memory.stage === 1 ? 5 : 15} (${memory.stage === 1 ? 'to Stage 2' : 'to Permanent'})
- **Days Until Expiry**: ${memory.days_until_expiry} ${urgency}
- **Last Accessed**: ${formatDate(memory.last_accessed)}

### Memory Details
- **ID**: ${memory.id}
- **Tags**: ${memory.tags.length > 0 ? memory.tags.join(', ') : 'None'}
- **Created**: ${formatDate(memory.created_at)}

💡 Use \`promote_memory\` or POST \`/api/memories/${memory.id}/promote\` to save permanently

---

`;
  });

  markdown += `## Pagination
- **Showing**: ${offset + 1} to ${Math.min(offset + memories.length, total)}
- **Total**: ${total}
- **Has More**: ${has_more ? 'Yes' : 'No'}`;

  return markdown;
}
```

## Frontend changes required

None required. The review endpoint is for maintenance use, not normal UI flow.

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `types/index.ts` | MODIFY | Update TemporaryMemory interface, add TemporaryMemoryWithMetadata type |
| `src/services/temporaryMemory.ts` | MODIFY | Replace extension_count with stage-based lifecycle, add listAllWithMetadata |
| `src/handlers/memory.ts` | MODIFY | Add listTemporaryMemories handler |
| `src/index.ts` | MODIFY | Add /api/memories/temporary route |
| `src/mcp/tools/memory.ts` | MODIFY | Add review_temporary_memories tool and handler |
| `src/mcp/server.ts` | MODIFY | Register review_temporary_memories tool |
| `src/mcp/utils/formatters.ts` | MODIFY | Add formatTemporaryMemoriesAsMarkdown |

## Acceptance Criteria

1. **Stage-Based Lifecycle**
   - New temporary memories start at Stage 1 with 14-day TTL
   - Each access increments `access_count` and resets TTL
   - At 5 accesses, advances to Stage 2 with 28-day TTL
   - At 15 accesses (Stage 2), auto-promotes to D1
   - `last_accessed` timestamp tracked on every access

2. **First-Class Citizenship**
   - `list_memories`, `find_memories` return temporary memories without lifecycle metadata
   - `get_memory` triggers access tracking but doesn't expose lifecycle metadata
   - Stats include temporary memories in counts
   - Users can't distinguish temporary from permanent in normal operations

3. **Review & Rescue Interface**
   - `GET /api/memories/temporary` returns temporary memories with lifecycle metadata
   - `review_temporary_memories` MCP tool provides same functionality
   - Response includes `days_until_expiry`, `access_count`, `stage`, `last_accessed`
   - Results sorted by urgency (most urgent first)
   - Users can use existing `promote` to save memories before expiry

4. **Backward Compatibility**
   - Existing promote endpoint/tool works unchanged
   - Manual promotion still possible at any stage
   - Auto-expiry via KV TTL still works

## Validation

### API Testing

1. **Create Temporary Memory**
```bash
curl -X POST http://localhost:8787/api/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "Test Temp", "content": "Test content", "temporary": true}'
```

2. **Access Memory Multiple Times (simulate lifecycle)**
```bash
# Access 5 times to advance to Stage 2
for i in {1..5}; do
  curl http://localhost:8787/api/memories/<id> -H "Authorization: Bearer <token>"
  sleep 1
done
```

3. **Review Temporary Memories**
```bash
curl http://localhost:8787/api/memories/temporary \
  -H "Authorization: Bearer <token>"
```
Expected: See memory with `stage: 2`, `access_count: 5`, `days_until_expiry` calculated

4. **Access 10 More Times (auto-promote)**
```bash
for i in {1..10}; do
  curl http://localhost:8787/api/memories/<id> -H "Authorization: Bearer <token>"
  sleep 1
done
```
Expected: Memory auto-promoted to D1, no longer appears in temporary review

### MCP Tool Testing

1. Create with `temporary: true` via `add_memory`
2. Access via `get_memory` multiple times
3. Use `review_temporary_memories` to see lifecycle metadata
4. Verify `list_memories` and `find_memories` don't show lifecycle metadata
5. Use `promote_memory` to manually promote before 15 accesses

## Implementation Order

1. Update `types/index.ts` (new interface)
2. Update `src/services/temporaryMemory.ts` (core lifecycle changes)
3. Update `src/mcp/utils/formatters.ts` (new formatter)
4. Update `src/handlers/memory.ts` (new handler)
5. Update `src/index.ts` (new route)
6. Update `src/mcp/tools/memory.ts` (new tool)
7. Update `src/mcp/server.ts` (register tool)
8. Test with wrangler dev
9. Deploy
