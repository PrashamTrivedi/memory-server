# Manual Testing Guide for REST API Markdown Responses

## Prerequisites
- Development server running: `npm run dev`
- curl or Postman installed
- Sample data in database (optional)

## Testing Strategy

### 1. Test Default JSON Response
```bash
# Should return JSON (default behavior)
curl http://localhost:8787/api/memories/stats

# Should return JSON (explicit Accept header)
curl http://localhost:8787/api/memories/stats \
  -H "Accept: application/json"
```

### 2. Test Markdown Response
```bash
# Should return markdown
curl http://localhost:8787/api/memories/stats \
  -H "Accept: text/markdown"
```

## Memory Endpoints Tests

### Test Stats Endpoint
```bash
# JSON format (default)
curl http://localhost:8787/api/memories/stats

# Markdown format
curl http://localhost:8787/api/memories/stats \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
# Memory Statistics

- **Total Memories**: 0
- **Recent Memories** (last 30 days): 0
- **Tagged Memories**: 0
- **Untagged Memories**: 0

## Summary
No memories stored yet.
```

### Test Create Memory
```bash
# Create memory with markdown response
curl -X POST http://localhost:8787/api/memories \
  -H "Accept: text/markdown" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Memory",
    "content": "This is a test memory for markdown response",
    "tags": ["test", "markdown"]
  }'
```

Expected Markdown Output:
```markdown
# Memory: Test Memory

This is a test memory for markdown response

## Metadata
- **ID**: [uuid]
- **Tags**: test, markdown
- **URL**: None
- **Created**: [date]
- **Updated**: [date]
```

### Test Get Memory
```bash
# Replace {id} with actual memory ID
curl http://localhost:8787/api/memories/{id} \
  -H "Accept: text/markdown"
```

### Test List Memories
```bash
curl http://localhost:8787/api/memories?limit=5 \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
# Memories

Showing 1 of 1 memories

## 1. Test Memory

This is a test memory...

- **ID**: [uuid]
- **Tags**: test, markdown
- **Updated**: [date]

---

## Pagination
- **Showing**: 1 to 1
- **Total**: 1
- **Has More**: No
```

### Test Update Memory
```bash
curl -X PUT http://localhost:8787/api/memories/{id} \
  -H "Accept: text/markdown" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Memory",
    "content": "Updated content"
  }'
```

### Test Search Memories
```bash
curl "http://localhost:8787/api/memories/search?query=test" \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
# Search Results

**Query**: "test"

Found **1** results

### Result 1: Test Memory

This is a test memory...

- **ID**: [uuid]
- **Tags**: test, markdown
- **URL**: None
- **Updated**: [date]

---

## Pagination
- **Showing**: 1 to 1
- **Total**: 1
- **Has More**: No
```

### Test Delete Memory
```bash
curl -X DELETE http://localhost:8787/api/memories/{id} \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
✅ Success

Memory deleted successfully

## Details
- **id**: [uuid]
- **deleted**: true
```

## Tag Hierarchy Endpoints Tests

### Test Create Tags with Relationship
```bash
curl -X POST http://localhost:8787/api/tags/create-with-parent \
  -H "Accept: text/markdown" \
  -H "Content-Type: application/json" \
  -d '{
    "child_tag_name": "javascript",
    "parent_tag_name": "programming"
  }'
```

Expected Markdown Output:
```markdown
# Tag Relationship Created

**Parent Tag**: programming (ID: 1)
**Child Tag**: javascript (ID: 2)

## Hierarchy
```
programming
└── javascript
```

The hierarchical relationship has been established successfully.
```

### Test Get Tag Tree
```bash
curl http://localhost:8787/api/tags/tree \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
# Tag Hierarchy Tree

- **programming** (ID: 1)
  - **javascript** (ID: 2)
  - **python** (ID: 3)
```

### Test Get Ancestors
```bash
curl http://localhost:8787/api/tags/2/ancestors \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
# Ancestor Tags

Reference Tag: **javascript**

Found 1 tag:

1. **programming** (ID: 1)
```

### Test Get Descendants
```bash
curl http://localhost:8787/api/tags/1/descendants \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
# Descendant Tags

Reference Tag: **programming**

Found 2 tags:

1. **javascript** (ID: 2)
2. **python** (ID: 3)
```

### Test Get Immediate Parents
```bash
curl http://localhost:8787/api/tags/2/parents \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
# Immediate Parents

Reference Tag: **javascript**

Found 1 tag:

1. **programming** (ID: 1)
```

### Test Get Immediate Children
```bash
curl http://localhost:8787/api/tags/1/children \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
# Immediate Children

Reference Tag: **programming**

Found 2 tags:

1. **javascript** (ID: 2)
2. **python** (ID: 3)
```

### Test Add Parent Relationship
```bash
curl -X POST http://localhost:8787/api/tags/2/parent \
  -H "Accept: text/markdown" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_tag_id": 1
  }'
```

Expected Markdown Output:
```markdown
✅ Success

Parent relationship created successfully

## Details
- **id**: 1
- **child_tag_id**: 2
- **parent_tag_id**: 1
- **created_at**: [timestamp]
```

### Test Remove Parent Relationship
```bash
curl -X DELETE http://localhost:8787/api/tags/2/parent/1 \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
✅ Success

Parent relationship removed successfully

## Details
- **removed**: true
```

## Error Response Tests

### Test 404 Not Found
```bash
curl http://localhost:8787/api/memories/nonexistent-id \
  -H "Accept: text/markdown"
```

Expected Markdown Output:
```markdown
❌ Error

Memory not found: nonexistent-id
```

### Test 400 Bad Request
```bash
curl -X POST http://localhost:8787/api/memories \
  -H "Accept: text/markdown" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected Markdown Output:
```markdown
❌ Error

Missing required fields: name and content are required
```

## Content-Type Verification

### Check Response Headers
```bash
# Should show: Content-Type: text/markdown; charset=utf-8
curl -I http://localhost:8787/api/memories/stats \
  -H "Accept: text/markdown"

# Should show: Content-Type: application/json
curl -I http://localhost:8787/api/memories/stats \
  -H "Accept: application/json"
```

## Backward Compatibility Tests

### Test React UI
1. Open http://localhost:8788 (React UI)
2. Verify all functionality works
3. Check browser network tab shows JSON responses
4. Confirm no breaking changes

### Test Existing API Clients
1. Test with no Accept header → should return JSON
2. Test with Accept: application/json → should return JSON
3. Test with Accept: */* → should return JSON (default)

## Edge Cases

### Test Empty Results
```bash
# Empty memory list
curl http://localhost:8787/api/memories?limit=10&offset=1000 \
  -H "Accept: text/markdown"

# Empty search results
curl "http://localhost:8787/api/memories/search?query=nonexistent" \
  -H "Accept: text/markdown"

# Empty tag tree
curl http://localhost:8787/api/tags/tree \
  -H "Accept: text/markdown"
```

### Test Special Characters
```bash
curl -X POST http://localhost:8787/api/memories \
  -H "Accept: text/markdown" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test with \"quotes\" and \u0027apostrophes\u0027",
    "content": "Content with **markdown** and `code` characters",
    "tags": ["test", "special-chars"]
  }'
```

### Test Large Result Sets
```bash
# Create multiple memories first, then test pagination
curl http://localhost:8787/api/memories?limit=100 \
  -H "Accept: text/markdown"
```

## Success Criteria

All tests should pass with:
- ✅ Correct markdown formatting
- ✅ Proper Content-Type headers
- ✅ Backward compatible JSON responses
- ✅ No breaking changes
- ✅ Error messages in markdown format
- ✅ Empty results handled gracefully
- ✅ Special characters properly escaped
- ✅ Pagination metadata included

## Notes

- Wrangler is required to run the development server
- Tests assume a clean database or sample data
- Replace `{id}` placeholders with actual IDs from your database
- Some tests require sequential execution (create before get/update/delete)
