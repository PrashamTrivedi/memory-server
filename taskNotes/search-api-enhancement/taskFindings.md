# Purpose

Ensure search API searches in both text and title fields for memories

## Original Ask
The search API should search in text and title.

## Complexity and the reason behind it
Complexity score: 1 out of 5
Reason: The functionality already exists in the backend. The FTS5 table is correctly configured to search both `name` (title) and `content` fields. This appears to be a documentation/clarity issue rather than a functional implementation task.

## Architectural changes required

None required. The system architecture already supports searching in both title and content fields through the FTS5 virtual table.

## Backend changes required

None required. The backend search implementation at `src/handlers/memory.ts` already uses FTS5 which searches both the `name` and `content` columns as configured in the database schema.

## Frontend changes required

Minor UI improvements for clarity:
1. Update the search placeholder text from "Search memories by content or tags..." to "Search memories by title, content or tags..."
2. Consider adding visual indicators in search results to show where the match occurred (title vs content)

## Acceptance Criteria

Not applicable (complexity < 3)

## Validation

Test the search functionality to confirm it searches in both fields:

1. **Backend API Testing:**
   - Test search with a query that only matches a memory title
   - Test search with a query that only matches memory content
   - Verify both return appropriate results

2. **Frontend Testing:**
   - Enter a search term that exists only in a memory's title
   - Enter a search term that exists only in a memory's content  
   - Confirm both searches return the expected memories

3. **Commands to verify:**
   ```bash
   # Create test memories via API
   curl -X POST http://localhost:8787/api/memories \
     -H "Content-Type: application/json" \
     -d '{"name": "Unique Title Test", "content": "Regular content here"}'
   
   curl -X POST http://localhost:8787/api/memories \
     -H "Content-Type: application/json" \
     -d '{"name": "Regular title", "content": "Unique Content Test"}'
   
   # Search for title match
   curl "http://localhost:8787/api/memories/search?query=Unique%20Title"
   
   # Search for content match  
   curl "http://localhost:8787/api/memories/search?query=Unique%20Content"
   ```

Both searches should return their respective memories, confirming the search works on both fields.