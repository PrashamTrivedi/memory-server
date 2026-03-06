# Clickable Tags - Task Walkthrough

## Setup

1. Start the backend server (Cloudflare Worker or local dev):
   ```bash
   npm run dev
   ```

2. Start the frontend dev server:
   ```bash
   cd ui && npx vite --port 5173
   ```

3. Open the app at `http://localhost:5173`

## How to Verify

### 1. View Memory Cards with Tags
- Navigate to the Memory Management page
- Ensure some memories exist with tags (create one if needed via "Create New Memory" button)
- Tags should appear as colored pills on each memory card

### 2. Click a Tag on a Memory Card
- Hover over a tag on any memory card — cursor should change to pointer
- Click the tag
- **Expected:** The memory list filters to show only memories with that tag
- **Expected:** A filter indicator appears above the list showing "Filtering by tag: {tagName}" with an X button

### 3. Clear the Tag Filter
- Click the X button on the filter indicator
- **Expected:** The filter is removed, all memories are shown again

### 4. Click a Tag in Memory Detail
- Click on a memory card to open the detail modal
- Click a tag in the Tags section of the detail modal
- **Expected:** The modal closes, and the list filters by that tag

### 5. Search Overrides Tag Filter
- While a tag filter is active, type a search query in the search bar
- **Expected:** The tag filter is cleared, search results are shown instead

### 6. Tag Click on a Card Doesn't Open Detail
- Click a tag on a memory card (not the card body)
- **Expected:** Only the tag filter activates; the memory detail modal does NOT open (click propagation is stopped)

## What to Verify

- Tags have `role="button"` and `tabIndex={0}` for accessibility
- Tags have `cursor: pointer` styling via `.clickable-tag` class
- `stopPropagation()` prevents card click when tag is clicked
- The `useMemoriesByTag` hook calls `GET /api/memories/search?tags={tag}` endpoint
- Filter indicator shows the correct tag name
- Clearing filter returns to paginated memory list with "Load More" available
- No console errors in the browser

## API Verification

The backend endpoint used for tag filtering:
```bash
curl "http://localhost:8787/api/memories/search?tags=your-tag-name"
```

Expected response: JSON with `memories` array containing only memories tagged with the specified tag.
