# Purpose

Redesign the Memory Server UI from a tab-based CRUD interface to a Notion/Confluence-inspired knowledge management interface with sidebar navigation, side peek panels, dual view modes, command palette, and responsive layout.

## Original Ask

Transform the existing React UI (`ui/`) into a Notion/Confluence-inspired memory browser with:
1. Left sidebar with collapsible tag hierarchy tree and memory counts
2. Top bar with always-visible search and quick actions
3. Breadcrumb navigation showing current context
4. Dual view modes: compact list view and card grid view
5. Side peek panel that slides in from the right for memory detail
6. Read-first content display with clean prose typography and rendered markdown
7. Inline editing via double-click or `E` key
8. Hover previews for URLs (OpenGraph) and tags (memory count + mini-list)
9. Tag sidebar with multi-select AND filtering, expand/collapse, memory counts
10. Command palette (Cmd+K) with fuzzy search, quick actions, keyboard navigation
11. Temporary memories integrated into same views with visual badges
12. Fully responsive: desktop (sidebar+content+peek), tablet (overlay sidebar), mobile (full-screen overlays, bottom nav)

## Complexity and the reason behind it

**4 out of 5** — This is a significant UI overhaul touching every page and component. The core data model and API layer remain unchanged, but the entire layout architecture shifts from tab-based navigation to a sidebar+content+peek panel pattern. New features include: markdown rendering, command palette, hover previews, dual view modes, and responsive breakpoints. The existing component library is mostly replaced rather than extended.

## Architectural changes required

### Layout Architecture Change

**Current:** Single-column layout with header nav tabs → full-width page content
**New:** Three-panel layout: `[Sidebar | Main Content | Peek Panel]`

```
┌──────────────────────────────────────────────────┐
│ Top Bar (search + actions + theme toggle)         │
├────────┬─────────────────────┬───────────────────┤
│        │ Breadcrumbs         │                   │
│ Tag    │ View Toggle + Sort  │  Peek Panel       │
│ Side-  │                     │  (memory detail,  │
│ bar    │ Memory List/Grid    │   rendered md,    │
│        │                     │   inline edit)    │
│        │                     │                   │
├────────┴─────────────────────┴───────────────────┤
│ (Mobile: bottom nav bar)                          │
└──────────────────────────────────────────────────┘
```

### State Management Changes

- Add URL-based routing for deep-linking (activate react-router-dom already installed)
- Lift tag filter state to app level (sidebar + content share it)
- Add global command palette state
- Add view mode state (list/card) persisted to localStorage
- Add peek panel state (open/closed, selected memory ID)

### New Dependencies

- `react-markdown` + `remark-gfm` + `rehype-highlight` — Markdown rendering
- `tailwindcss` + `@tailwindcss/typography` — Design system (already in mcp-apps, unify)
- `fuse.js` — Fuzzy search for command palette

### Files Removed (replaced by new architecture)

All existing `.css` files in `ui/src/` will be replaced by Tailwind utility classes. The component structure is largely rebuilt.

## Frontend changes required

### Phase 1: Foundation — Tailwind + Layout Shell + Routing

1. **Install Tailwind CSS** in `ui/` (postcss, autoprefixer, tailwind config)
   - Port CSS variables (colors, spacing, shadows) to Tailwind theme config
   - Add `@tailwindcss/typography` plugin for prose styling
   - Keep dark mode via `data-theme` attribute (Tailwind `selector` strategy)

2. **Set up React Router** (already installed, not wired up)
   - Routes: `/` (memories), `/tags` (tag management), `/settings` (API keys, MCP apps, skill download)
   - Memory detail as URL param: `/memories/:id` opens peek panel
   - Tag filter as query param: `?tag=design`

3. **Create Layout Shell** (`components/Layout.tsx`)
   - Three-panel responsive container
   - Sidebar (collapsible, 280px default)
   - Main content area (flexible)
   - Peek panel (400px, slides from right, overlay on smaller screens)
   - Top bar with search and actions

### Phase 2: Tag Sidebar

4. **Sidebar component** (`components/Sidebar.tsx`)
   - Reuse `useTagHierarchy` hook
   - Render tag tree with expand/collapse
   - Show memory count per tag (new API field or client-side count)
   - Multi-tag selection with AND logic
   - Visual highlight for active filters
   - Collapse toggle button
   - Responsive: overlay drawer on tablet/mobile

### Phase 3: Memory Views

5. **Memory List View** (`components/MemoryListView.tsx`)
   - Compact table-like rows: title, tag pills, date, content snippet
   - Click to open peek panel
   - Hover shows subtle highlight

6. **Memory Card View** (`components/MemoryCardView.tsx`)
   - Grid of cards with title, tags, rendered markdown preview (~3 lines)
   - Click to open peek panel

7. **View Switcher** — Toggle between list/card, persist to localStorage
8. **Sort Controls** — By date created, updated, alphabetical

### Phase 4: Peek Panel + Markdown Rendering

9. **Peek Panel** (`components/PeekPanel.tsx`)
   - Slides from right, 400-500px width
   - Rendered markdown content using `react-markdown`
   - Clean prose typography via `@tailwindcss/typography`
   - Tags as pills, metadata (dates, URL)
   - Close on Esc or close button
   - Edit/delete actions in panel header

10. **Inline Editor** (`components/InlineEditor.tsx`)
    - Double-click or `E` key activates
    - Textarea replaces rendered content in-place
    - Explicit Save button (or Cmd+Enter) to persist changes
    - Esc discards unsaved changes and returns to read view
    - Click outside also discards and returns to read view
    - Name, content, tags, URL all editable

### Phase 5: Search + Command Palette

11. **Top Bar Search** — Always-visible, filters memory list in real-time
12. **Command Palette** (`components/CommandPalette.tsx`)
    - Cmd+K trigger
    - Fuzzy search with `fuse.js` across memory names and content
    - Quick actions: create memory, filter by tag, switch view, navigate
    - Recent memories shown before typing
    - Arrow keys + Enter navigation
    - Keyboard shortcut hints

### Phase 6: Hover Previews

13. **Tag Preview Popover** (`components/TagPreview.tsx`)
    - On tag pill hover (200ms delay)
    - Shows tag name, memory count, top 5 memories
    - "View all" link applies filter

14. **URL Preview Popover** (`components/UrlPreview.tsx`)
    - On link hover in rendered markdown (300ms delay)
    - Shows page title, description, favicon from OG data
    - Data pre-cached via `CACHE_KV` (backend already has `update_url_content`)
    - If no cache data: show a "Refresh" button that triggers a fetch and stores in cache
    - After refresh, data is available on next hover (not shown inline immediately — avoids layout shift)
    - Skeleton/placeholder shown while no data and no refresh clicked

### Phase 7: Temporary Memories Integration

15. **Unified memory list** — Temporary memories show in same views
    - Visual badge: "Temporary" pill with stage and days remaining
    - Filter toggle: all / permanent only / temporary only
    - Promote/drop actions in peek panel and on hover

### Phase 8: Settings Page Consolidation

16. **Settings page** — Consolidate API Keys, Skill Download, MCP Apps Admin
    - Sub-navigation or accordion sections
    - Keep existing functionality, restyle with Tailwind

### Phase 9: Responsive Design

17. **Desktop** (>1024px): Full sidebar + content + peek panel
18. **Tablet** (768-1024px): Sidebar as overlay drawer, peek panel wider
19. **Mobile** (<768px):
    - Hamburger menu for sidebar
    - Full-width list/card view
    - Peek panel as full-screen overlay
    - Bottom navigation bar (search, tags, create)
    - Swipe to dismiss peek

### Phase 10: Breadcrumbs + Polish

20. **Breadcrumbs** (`components/Breadcrumbs.tsx`)
    - Shows: All Memories > [active tag path] > [memory name if peek open]
    - Clickable segments for navigation

21. **Keyboard shortcuts**
    - `Cmd+K` — Command palette
    - `E` — Edit (when peek panel focused)
    - `Esc` — Close peek panel / exit edit mode
    - `[` — Toggle sidebar
    - `/` — Focus search

## Backend changes required

None. The existing API endpoints provide all needed data. The tag tree endpoint already returns hierarchy with counts derivable from the tree structure. URL preview data uses the existing `CACHE_KV` infrastructure.

One optional enhancement: add a `memory_count` field to the tag tree API response for each tag node — but this can be computed client-side from memory data.

## Acceptance Criteria

1. Sidebar shows full tag hierarchy tree, clickable to filter memories, collapsible
2. Memory list shows in both list (compact rows) and card (grid) view modes
3. Clicking a memory opens a side peek panel with rendered markdown content
4. Double-click or `E` key activates inline editor; Cmd+Enter saves, Esc discards and returns to read view
5. Cmd+K opens command palette with fuzzy search and quick actions
6. Tag pills on hover show preview popover with memory count and top 5 memories
7. Temporary memories appear in same views with lifecycle badges and promote actions
8. Layout is responsive: sidebar collapses on tablet, full-screen overlays on mobile
9. Search in top bar filters memories in real-time
10. Breadcrumbs show current navigation context
11. All existing CRUD functionality (create, edit, delete, search, tag filter) is preserved
12. Settings page consolidates API Keys, Skill Download, and MCP Apps Admin

## Validation

### Manual Testing Steps

1. **Sidebar Navigation**: Click tags in sidebar → verify memory list filters. Expand/collapse tag groups. Multi-select tags → verify AND filtering.
2. **View Modes**: Toggle list ↔ card view. Verify data consistency. Refresh page → verify mode persists.
3. **Peek Panel**: Click memory → panel slides in. Verify rendered markdown. Press Esc → panel closes. Verify list stays visible behind panel.
4. **Inline Edit**: Double-click content → verify editor appears. Edit → Cmd+Enter → verify saved. Edit → press Esc → verify changes discarded. Press `E` key → verify editor activates.
5. **Command Palette**: Press Cmd+K → verify palette opens. Type query → verify fuzzy search. Arrow keys → verify navigation. Enter → verify action executes.
6. **Tag Hover Preview**: Hover tag pill → verify popover after delay. Verify memory count and mini-list. Click "View all" → verify filter applied.
7. **Temporary Memories**: Verify badges show in list. Promote from peek panel. Filter temporary/permanent.
8. **Responsive**: Resize to tablet → verify sidebar becomes drawer. Resize to mobile → verify full-screen overlays and bottom nav.
9. **Search**: Type in top bar → verify real-time filtering. Clear → verify all memories shown.
10. **CRUD**: Create memory → verify appears in list. Edit → verify updates. Delete → verify removed.

### Build Verification

```bash
cd ui && npm run build
# Should produce clean build with no TypeScript errors
```
