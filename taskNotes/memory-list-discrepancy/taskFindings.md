# Purpose

Fix the off-by-one error in memory list pagination causing discrepancy between total count and displayed cards

## Original Ask
UI server is running, connect with http://localhost:38921/ on browser, see the discrepancy between total memories and the card shown in list. (The card probably have off by one error)

## Complexity and the reason behind it
Complexity score: 1/5 - Simple pagination calculation error in the frontend API client

## Architectural changes required
None required

## Backend changes required
None required - backend handles offset correctly

## Frontend changes required
Fix the offset calculation in the memory API client to properly calculate offset from page number:
- Change `offset=${page}` to `offset=${page * limit}` in the getMemories function

## Validation
1. Check the UI at http://localhost:38921/
2. Verify that the number of memory cards displayed matches the total count shown
3. Test pagination if there are more than 20 memories to ensure proper page transitions