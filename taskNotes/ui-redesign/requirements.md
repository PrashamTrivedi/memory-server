# UI Redesign: Notion/Confluence-Inspired Memory Browser

## Target
The main React web app (`ui/`). Not the MCP Apps embedded in Claude.ai.

## Core Vision
A knowledge management interface reminiscent of Confluence and Notion — clean, content-focused, with rich markdown rendering and intuitive tag-based organization. The interface should feel like a standalone product for browsing, reading, and managing memories.

---

## Requirements

### 1. Layout & Navigation

- **Left sidebar**: Dedicated to tag hierarchy. Collapsible. Shows the full tag tree with parent-child nesting and memory counts per tag. Clicking a tag filters the main content area to show only memories with that tag.
- **Top bar**: Contains search input and quick action triggers. Always visible. Serves as the primary entry point for finding content.
- **Breadcrumbs**: Show current navigation context (e.g., "All Memories > design > ui-patterns") in the content area. Especially useful when sidebar is collapsed on smaller screens.

### 2. Memory List — Two View Modes

A view switcher allows toggling between:

- **List view**: Compact rows showing memory title, tag pills, created date, and a brief content snippet. Scannable and dense. Good for power users who want to skim quickly.
- **Card view**: Grid of cards with memory title, tags, and a content preview (first ~3 lines of rendered markdown). More visual, better for browsing and discovery.

Both views share the same filter and sort state. Sorting options: by date created, date updated, alphabetical.

### 3. Memory Detail — Side Peek Panel

- Clicking a memory in the list/card view opens a **side peek panel** that slides in from the right.
- The list/card view remains visible on the left (narrowed), so the user doesn't lose their browsing context.
- The peek panel shows the full rendered memory content, tags, metadata (created date, updated date, source URL if present).
- A close button or pressing `Esc` dismisses the panel.

### 4. Content Display — Read-First with Inline Edit

- Memories default to a **clean read view** with rendered markdown. No editing affordances visible by default.
- The read view uses **clean prose** typography: well-chosen fonts, comfortable line height, proper heading hierarchy, good spacing between elements. Not heavy block-based styling — more like a well-formatted document.
- To edit: double-click the content area or press `E` to switch to an inline editor. The editor replaces the rendered content in place.
- Pressing `Esc` or clicking outside saves and returns to read view.
- Show metadata alongside content: tags as pills, created/updated dates, source URL as a link.

### 5. Hover Previews

Two types of hover previews provide context without navigating away:

**URL previews** — Hovering a hyperlink inside a memory's rendered markdown shows a rich preview card:
- Page title, description, and favicon extracted from OpenGraph/meta tags.
- Metadata is **pre-cached on save**: when a memory containing URLs is saved, Cloudflare Browser Rendering fetches the OG data and stores it in `CACHE_KV`.
- Hover previews load instantly from cache — no on-the-fly fetching.
- Leverages the existing `update_url_content` infrastructure and `BROWSER` binding.

**Tag previews** — Hovering a tag pill (anywhere: in the list, in the detail panel, in the sidebar) shows a popover with:
- Tag name and memory count.
- A mini-list of the top ~5 memories with that tag.
- A "View all" link that applies that tag as a filter.

Both previews appear after a short delay (~200-300ms) to avoid accidental triggers.

### 6. Tag Sidebar

- Displays the full tag hierarchy as a collapsible tree.
- Each tag shows its memory count in parentheses (e.g., "design (12)").
- Parent tags are expandable/collapsible to show child tags.
- Clicking a tag filters the memory list to that tag (including children).
- Active tag filter is visually highlighted in the sidebar.
- Multiple tags can be selected to narrow the filter (AND logic).

### 7. Search & Command Palette

- **Top bar search**: Always-visible search input for filtering memories by text content.
- **Command palette (Cmd+K)**: Opens a modal overlay with:
  - Fuzzy search across all memories (by name and content).
  - Quick actions: create new memory, filter by tag, switch view mode, navigate to settings.
  - Recent memories shown by default before typing.
  - Keyboard-navigable results (arrow keys + Enter).
  - Keyboard shortcuts shown next to actions.

### 8. Temporary Memories — Integrated

- Temporary memories appear in the same list/card views as permanent memories.
- They are distinguished by a visual badge or indicator (e.g., a subtle "temporary" pill or icon).
- The badge shows lifecycle stage and days remaining.
- Promote and drop actions are available inline (in the side peek panel and on hover in the list).
- A filter option to show "only temporary" or "only permanent" memories.

### 9. Responsive Design — Fully Responsive

- **Desktop**: Full sidebar + content + peek panel layout. All features available.
- **Tablet**: Sidebar collapses to an overlay/drawer. Peek panel takes more width.
- **Mobile**: Sidebar accessible via hamburger menu. List/card view is full-width. Peek panel becomes a full-screen overlay. Touch-friendly tap targets. Bottom navigation bar for primary actions (search, tags, create). Swipe gestures where appropriate (e.g., swipe to dismiss peek panel).

---

## Explicitly Out of Scope

- **History/versioning**: No memory edit history or version tracking.
- **Color palette decisions**: Will be decided separately from this feature work.
- **MCP Apps redesign**: The embedded Claude.ai apps are not part of this work.
- **Real-time collaboration**: Single-user experience only.
- **Inline database/table views**: No Notion-style database views with sortable columns.

---

## Tech Stack Decision

**Framework: React SPA** (keep existing React 18 + Vite setup in `ui/`).

Astro was evaluated and ruled out. While memories are content-like (write-once, read-many, markdown-heavy), the interaction model requires SPA architecture:
- Side peek panel needs list + detail sharing state simultaneously
- Tag filtering needs instant re-render without page navigation
- Command palette is a global overlay requiring app-wide state access
- Inline editing requires in-place mode switching within the content area

These interactions require a single connected component tree with shared state — Astro's island architecture would require wrapping everything in one React island, defeating its purpose.

**No framework migration needed.** Enhance the existing stack:
- React 18 + Vite (already in place)
- TanStack Query (already in place for API data)
- Add client-side routing (TanStack Router or React Router — currently missing, only in-memory state)
- Add Tailwind CSS (already used in mcp-apps, unify the design system)
- Add a markdown rendering library (react-markdown + rehype plugins)

---

## UX Principles

1. **Content is king** — The interface should get out of the way and let the markdown content shine.
2. **Read more than write** — Optimize for browsing and reading. Editing should be easy but not the default state.
3. **Progressive disclosure** — Show actions on hover/interaction, not cluttering the default view.
4. **Keyboard-friendly** — Power users should be able to navigate, search, and act without touching the mouse.
5. **Fast and fluid** — Transitions should be smooth. Filtering and search should feel instant.
