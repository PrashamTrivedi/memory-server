# Purpose
Enable partial word search functionality for better memory discovery

## Original Ask
I want search to be done by partial words as well. If there is an entry with word Request, I should search with `req` and one such entry should be surfaced

## Complexity and the reason behind it
Complexity score: 2/5 - Moderate complexity because we need to modify the search query processing to add wildcard support while maintaining FTS5 compatibility

## Architectural changes required
None required - the FTS5 virtual table already supports prefix searches

## Backend changes required
1. Modify `searchMemoriesByQuery` function to add wildcard suffix to search terms
2. Modify `searchMemoriesByQueryAndTags` function similarly  
3. Handle special FTS5 characters properly to avoid query errors

## Frontend changes required
None required - the SearchBar component already sends the query as-is

## Validation
- Test searching with partial words: "req" should find "Request", "requirement", etc.
- Test with multiple word searches: "req mem" should find "Request memory"
- Verify existing full word searches still work
- Test edge cases with special characters