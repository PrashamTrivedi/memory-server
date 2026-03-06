# Clickable Tags Feature

## Original Ask
"We need to have tags clickable, so that on each tag, I will be able to see which memories are associated with it."

## Current State
- Tags displayed as plain `<span>` elements in MemoryCard, MemoryDetail, and TemporaryMemoryCard
- Backend already supports tag-based search via `GET /api/memories/search?tags=tag1,tag2`
- Frontend `useSearchMemories` hook only fires when text query is present (needs fix for tag-only filtering)
- App uses manual `currentView` state pattern (no router)

## Implementation Plan

### 1. Make tags clickable in MemoryCard, MemoryDetail, TemporaryMemoryCard
- Add `onTagClick?: (tag: string) => void` prop
- Change tag spans to clickable elements with `e.stopPropagation()` and cursor: pointer

### 2. Thread `onTagClick` through MemoryList
- Pass callback from MemoryManagement down to MemoryCard

### 3. Add tag filtering to MemoryManagement
- Add `activeTag` state
- Add `useMemoriesByTag` hook or fix `useSearchMemories` enabled condition
- Show active tag filter indicator with clear button
- When tag clicked: set activeTag, show filtered memories

### 4. Add/update CSS for clickable tags and filter indicator

## Files to Modify
| File | Change |
|------|--------|
| ui/src/components/MemoryCard.tsx | Add onTagClick prop, make tags clickable |
| ui/src/components/MemoryCard.css | cursor: pointer for tags |
| ui/src/components/MemoryDetail.tsx | Add onTagClick prop, make tags clickable |
| ui/src/components/MemoryDetail.css | clickable tag styles |
| ui/src/components/TemporaryMemoryCard.tsx | Add onTagClick prop, make tags clickable |
| ui/src/components/MemoryList.tsx | Thread onTagClick prop |
| ui/src/pages/MemoryManagement.tsx | activeTag state, filter UI, wire onTagClick |
| ui/src/pages/MemoryManagement.css | tag filter indicator styles |
| ui/src/api/memory.ts | Add useMemoriesByTag hook |

## Complexity Score: 3/10
Straightforward UI feature. Backend already supports tag filtering. All changes are frontend-only.
