# Task Walkthrough: Temporary Memories V2 with Review & Rescue

## Overview

This task upgraded the temporary memories system from a simple 3-access extension model to a sophisticated 2-stage lifecycle with a dedicated review interface.

## What Changed

### Before (V1)
- `extension_count` tracked 0→1→2→promote
- 3 accesses to become permanent
- No way to review temporary memories separately

### After (V2)
- Stage-based lifecycle: Stage 1 (14-day TTL) → Stage 2 (28-day TTL) → Permanent
- 5 accesses to advance to Stage 2
- 15 total accesses to auto-promote
- Dedicated review interface showing lifecycle metadata

---

## Verification Steps for Product Owners

### 1. Create a Temporary Memory

**REST API:**
```bash
curl -X POST http://localhost:8787/api/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "Test Temp Memory", "content": "Testing lifecycle", "temporary": true}'
```

**MCP Tool:**
```json
{
  "tool": "add_memory",
  "arguments": {
    "name": "Test Temp Memory",
    "content": "Testing lifecycle",
    "temporary": true
  }
}
```

**Expected:** Memory created with Stage 1, 14-day TTL, access_count=0

---

### 2. Verify First-Class Citizenship

**List all memories:**
```bash
curl http://localhost:8787/api/memories \
  -H "Authorization: Bearer <token>"
```

**Expected:** Temporary memory appears alongside permanent memories WITHOUT showing lifecycle metadata (access_count, stage, etc.)

---

### 3. Review Temporary Memories (New Feature)

**REST API:**
```bash
curl http://localhost:8787/api/memories/temporary \
  -H "Authorization: Bearer <token>"
```

**MCP Tool:**
```json
{
  "tool": "review_temporary_memories",
  "arguments": {}
}
```

**Expected Response includes:**
- `access_count`: 0
- `stage`: 1
- `days_until_expiry`: ~14
- `last_accessed`: timestamp
- Urgency indicator (green for safe, yellow for soon, red for urgent)

---

### 4. Test Stage Advancement

Access the memory 5 times:
```bash
for i in {1..5}; do
  curl http://localhost:8787/api/memories/<id> \
    -H "Authorization: Bearer <token>"
  sleep 1
done
```

**Expected after 5 accesses:**
- `stage`: 2
- `access_count`: 5
- `days_until_expiry`: ~28 (TTL extended)

---

### 5. Test Auto-Promotion

Access the memory 10 more times (total 15):
```bash
for i in {1..10}; do
  curl http://localhost:8787/api/memories/<id> \
    -H "Authorization: Bearer <token>"
  sleep 1
done
```

**Expected:**
- Memory automatically promoted to permanent (D1 database)
- No longer appears in `GET /api/memories/temporary`
- Still appears in `GET /api/memories` (now permanent)

---

### 6. Test Manual Promotion (Rescue)

Create another temporary memory, then promote it manually:

**REST API:**
```bash
curl -X POST http://localhost:8787/api/memories/<id>/promote \
  -H "Authorization: Bearer <token>"
```

**MCP Tool:**
```json
{
  "tool": "promote_memory",
  "arguments": {"id": "<memory-id>"}
}
```

**Expected:** Memory immediately becomes permanent regardless of access count

---

### 7. Verify UI Dashboard

1. **Navigate to Memory Server UI**
2. **Click "Temporary" in the navigation bar**
3. **Verify dashboard displays:**
   - Total count of temporary memories
   - Urgent count (≤3 days until expiry) in red
   - Soon count (4-7 days) in yellow
   - Safe count (>7 days) in green

4. **Verify memory cards show:**
   - Stage badge (Stage 1 or Stage 2)
   - Days until expiry with color-coded urgency
   - Progress bar toward next stage
   - Access count
   - Last accessed timestamp

5. **Test promote from UI:**
   - Click star icon on a memory card
   - Verify spinner appears during promotion
   - Verify memory disappears after successful promotion

---

## Key Files Modified

### Backend
| File | Change |
|------|--------|
| `types/index.ts` | New `TemporaryMemoryWithMetadata` type, updated `TemporaryMemory` |
| `src/services/temporaryMemory.ts` | Stage-based lifecycle, `listAllWithMetadata()` |
| `src/handlers/memory.ts` | `listTemporaryMemories` handler |
| `src/index.ts` | `/api/memories/temporary` route |
| `src/mcp/tools/memory.ts` | `review_temporary_memories` tool |
| `src/mcp/server.ts` | Tool registration |
| `src/mcp/utils/formatters.ts` | `formatTemporaryMemoriesAsMarkdown` |

### Frontend (UI)
| File | Change |
|------|--------|
| `ui/src/types/memory.ts` | `TemporaryMemoryWithMetadata` type |
| `ui/src/api/memory.ts` | `useTemporaryMemories()`, `usePromoteMemory()` hooks |
| `ui/src/components/TemporaryMemoryCard.tsx` | Card component with lifecycle display |
| `ui/src/components/TemporaryMemoryCard.css` | Card styling with urgency colors |
| `ui/src/pages/TemporaryMemoryReview.tsx` | Review page with stats dashboard |
| `ui/src/pages/TemporaryMemoryReview.css` | Page styling |
| `ui/src/pages/index.ts` | Export new page |
| `ui/src/App.tsx` | Navigation for "Temporary" view |

---

## Commits

1. `41fcc3e ✨ feat: Add stage-based lifecycle and review interface for temporary memories`
2. `cdcb7bf ✨ feat: Add temporary memories review UI with lifecycle dashboard`
3. `e29b705 🐛 fix: Add defensive defaults for legacy temporary memory data`

---

## Acceptance Criteria Checklist

- [x] Stage 1: 14-day TTL, 5 accesses to advance
- [x] Stage 2: 28-day TTL, 15 total accesses to promote
- [x] Temporary memories hidden in normal list/search (first-class citizen)
- [x] Review endpoint shows lifecycle metadata
- [x] Sorted by urgency (most urgent first)
- [x] Manual promotion still works
- [x] MCP tool for review interface
- [x] UI dashboard with stats and memory cards
- [x] UI promote functionality
- [x] Documentation updated
