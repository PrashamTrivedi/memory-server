# Temporary Memories Feature - Verification Walkthrough

## Overview

This walkthrough guides Product Owners through verifying the Temporary Memories feature implementation.

## Prerequisites

1. Create the KV namespace in Cloudflare:
   ```bash
   wrangler kv namespace create "TEMP_MEMORIES_KV"
   ```

2. Update `wrangler.jsonc` with the actual KV namespace ID

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Verification Steps

### Step 1: Create a Temporary Memory

**REST API:**
```bash
curl -X POST http://localhost:8787/api/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "name": "Test Temporary Memory",
    "content": "This is a test temporary memory",
    "tags": ["test", "temporary"],
    "temporary": true
  }'
```

**Expected:** Returns memory object with ID. No indication of temporary status in response.

**MCP Tool:**
```json
{
  "name": "add_memory",
  "arguments": {
    "name": "Test Temporary Memory",
    "content": "This is a test temporary memory",
    "tags": ["test"],
    "temporary": true
  }
}
```

### Step 2: Verify Memory Appears in Listings

```bash
curl http://localhost:8787/api/memories \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected:** The temporary memory appears in the list alongside permanent memories.

### Step 3: Access Memory to Extend TTL

```bash
curl http://localhost:8787/api/memories/{memory_id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected:** Memory is returned. Internally, TTL is extended to 28 days and extension_count increments.

### Step 4: Search for Temporary Memory

```bash
curl "http://localhost:8787/api/memories/search?query=temporary" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected:** Temporary memory appears in search results.

### Step 5: Manual Promotion

```bash
curl -X POST http://localhost:8787/api/memories/{memory_id}/promote \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected:**
- Success response with `promoted: true`
- Memory is now permanent (stored in D1)

**MCP Tool:**
```json
{
  "name": "promote_memory",
  "arguments": {
    "id": "{memory_id}"
  }
}
```

### Step 6: Verify Promotion Error for Permanent Memory

```bash
curl -X POST http://localhost:8787/api/memories/{same_memory_id}/promote \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected:** Error response: "Memory is already permanent"

### Step 7: Delete Temporary Memory

Create another temporary memory, then delete it:

```bash
curl -X DELETE http://localhost:8787/api/memories/{temp_memory_id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected:** Memory is deleted successfully.

## Lifecycle Verification (Advanced)

To verify the full lifecycle (14-day → 28-day → auto-promote), you would need to:

1. Create a temporary memory
2. Check KV directly: `wrangler kv key get --namespace-id={id} "temp_memory:{memory_id}"`
3. Observe `extension_count: 0` and 14-day TTL
4. Access the memory 3 times
5. Verify on 3rd access, memory moves from KV to D1

## Key Behaviors to Verify

| Behavior | Verification Method |
|----------|---------------------|
| Temporary memories hidden from API | Response never includes `extension_count` or `temporary` status |
| TTL extends on access | Check KV directly after access |
| Auto-promotion after 3 accesses | Memory moves from KV to D1 |
| Manual promotion | POST `/api/memories/{id}/promote` works |
| List merges both stores | Temporary and permanent memories appear together |
| Search works across both | FTS and tag search find both |
| Delete works for both | DELETE removes from correct store |

## Files Changed

| File | Description |
|------|-------------|
| `types/index.ts` | Added `temporary` flag and `TemporaryMemory` type |
| `src/services/temporaryMemory.ts` | NEW - Core TTL lifecycle logic |
| `src/handlers/memory.ts` | Updated create, get, list, find, delete + promoteMemory |
| `src/index.ts` | Added `/api/memories/:id/promote` route |
| `src/mcp/tools/memory.ts` | Updated MCP tools + promote_memory |
| `src/mcp/tools/search.ts` | Updated find_memories to merge KV results |
| `src/mcp/server.ts` | Registered promote_memory tool |
| `wrangler.jsonc` | Added TEMP_MEMORIES_KV namespace |
| `README.md` | Added feature documentation |

## Next Steps

1. Test in staging environment
2. Create KV namespace in production
3. Deploy to production
4. Monitor KV usage and memory promotion patterns
