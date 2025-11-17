---
name: memory-server-rest-api
description: Interact with the Memory Server using REST API calls. Use when working with developer memories, storing knowledge, searching notes, managing tags, or organizing information hierarchically. Supports creating, reading, updating, and deleting memories via HTTP requests.
---

# Memory Server REST API Skill

This skill enables Claude to interact with the Memory Server using REST API calls via curl commands. Use this when you need to manage developer memories, store knowledge, search notes, or work with hierarchical tags.

## Prerequisites

Before using this skill, ensure:
1. The Memory Server is running (locally on `http://localhost:8787` or deployed to Cloudflare Workers)
2. You have the base URL of the server (set `MEMORY_SERVER_URL` environment variable or use localhost)

## API Overview

The Memory Server provides 15 REST API endpoints supporting both JSON (default) and Markdown response formats via content negotiation.

### Content Negotiation

All endpoints support two response formats:
- **JSON** (default): `Accept: application/json` or no header
- **Markdown**: `Accept: text/markdown`

## Memory Management Operations

### 1. Create a Memory

Store new information with optional tags and hierarchical organization.

```bash
curl -X POST $MEMORY_SERVER_URL/api/memories \
  -H "Content-Type: application/json" \
  -H "Accept: text/markdown" \
  -d '{
    "name": "React Hooks Guide",
    "content": "Comprehensive guide to React hooks including useState, useEffect, and custom hooks",
    "url": "https://react.dev/hooks",
    "tags": ["programming>javascript", "frontend>react", "tutorial"]
  }'
```

**Hierarchical Tags**: Use `parent>child` format to automatically create tag hierarchies:
- `programming>javascript` - Creates both tags and parent-child relationship
- Mix hierarchical and simple tags: `["programming>javascript", "tutorial"]`

### 2. List All Memories

Retrieve paginated list of all stored memories, optionally filtered by tags.

```bash
# List first 10 memories
curl "$MEMORY_SERVER_URL/api/memories?limit=10&offset=0" \
  -H "Accept: text/markdown"

# List memories with specific tags
curl "$MEMORY_SERVER_URL/api/memories?tags=react,javascript&limit=20" \
  -H "Accept: text/markdown"
```

**Query Parameters**:
- `limit`: Number of results per page (default: 50)
- `offset`: Starting position for pagination (default: 0)
- `tags`: Comma-separated list of tag names to filter by

### 3. Get a Specific Memory

Retrieve complete details of a single memory by ID.

```bash
curl "$MEMORY_SERVER_URL/api/memories/{memory-id}" \
  -H "Accept: text/markdown"
```

Replace `{memory-id}` with the actual UUID of the memory.

### 4. Update a Memory

Modify existing memory content, name, URL, or tags.

```bash
curl -X PUT "$MEMORY_SERVER_URL/api/memories/{memory-id}" \
  -H "Content-Type: application/json" \
  -H "Accept: text/markdown" \
  -d '{
    "name": "Updated React Hooks Guide",
    "content": "Updated comprehensive guide...",
    "url": "https://react.dev/hooks",
    "tags": ["programming>javascript", "frontend>react", "tutorial", "advanced"]
  }'
```

### 5. Delete a Memory

Permanently remove a memory from the system.

```bash
curl -X DELETE "$MEMORY_SERVER_URL/api/memories/{memory-id}" \
  -H "Accept: text/markdown"
```

### 6. Search Memories

Perform full-text search across all memory content.

```bash
curl "$MEMORY_SERVER_URL/api/memories/search?query=React+hooks+useState&tags=react&limit=5" \
  -H "Accept: text/markdown"
```

**Query Parameters**:
- `query`: Full-text search query
- `tags`: Filter by comma-separated tags
- `limit`: Maximum results to return

### 7. Get Memory Statistics

Retrieve statistics about stored memories.

```bash
curl "$MEMORY_SERVER_URL/api/memories/stats" \
  -H "Accept: text/markdown"
```

## Tag Hierarchy Operations

### 1. Create Tag Hierarchy

Establish parent-child relationships between tags.

```bash
curl -X POST "$MEMORY_SERVER_URL/api/tags/create-with-parent" \
  -H "Content-Type: application/json" \
  -H "Accept: text/markdown" \
  -d '{
    "child_tag_name": "javascript",
    "parent_tag_name": "programming"
  }'
```

**Smart Creation Rules**:
- Both tags exist: Returns error (prevents disrupting existing relationships)
- One tag exists: Creates missing tag and establishes relationship
- Neither exists: Creates both tags and establishes relationship

### 2. Get Complete Tag Tree

Retrieve the entire hierarchical tag structure.

```bash
curl "$MEMORY_SERVER_URL/api/tags/tree" \
  -H "Accept: text/markdown"
```

### 3. Get Tag Ancestors

Find all ancestor tags (parents, grandparents, etc.) for a specific tag.

```bash
curl "$MEMORY_SERVER_URL/api/tags/{tag-id}/ancestors" \
  -H "Accept: text/markdown"
```

### 4. Get Tag Descendants

Find all descendant tags (children, grandchildren, etc.) for a specific tag.

```bash
curl "$MEMORY_SERVER_URL/api/tags/{tag-id}/descendants" \
  -H "Accept: text/markdown"
```

### 5. Get Immediate Parents

Retrieve only the direct parent tags of a specific tag.

```bash
curl "$MEMORY_SERVER_URL/api/tags/{tag-id}/parents" \
  -H "Accept: text/markdown"
```

### 6. Get Immediate Children

Retrieve only the direct child tags of a specific tag.

```bash
curl "$MEMORY_SERVER_URL/api/tags/{tag-id}/children" \
  -H "Accept: text/markdown"
```

### 7. Add Parent Relationship

Add a new parent to an existing tag.

```bash
curl -X POST "$MEMORY_SERVER_URL/api/tags/{tag-id}/parent" \
  -H "Content-Type: application/json" \
  -H "Accept: text/markdown" \
  -d '{
    "parent_id": "{parent-tag-id}"
  }'
```

### 8. Remove Parent Relationship

Remove a parent-child relationship between tags.

```bash
curl -X DELETE "$MEMORY_SERVER_URL/api/tags/{tag-id}/parent/{parent-tag-id}" \
  -H "Accept: text/markdown"
```

## Response Format Examples

### JSON Response (Default)

```json
{
  "success": true,
  "data": {
    "id": "abc-123-def",
    "name": "React Hooks Guide",
    "content": "Comprehensive guide to React hooks...",
    "tags": ["programming", "javascript", "react"],
    "url": "https://react.dev/hooks",
    "created_at": 1730898645,
    "updated_at": 1730898645
  }
}
```

### Markdown Response (Accept: text/markdown)

```markdown
# Memory: React Hooks Guide

Comprehensive guide to React hooks...

## Metadata
- **ID**: abc-123-def
- **Tags**: programming, javascript, react
- **URL**: https://react.dev/hooks
- **Created**: Nov 06, 2025 14:30:45
- **Updated**: Nov 06, 2025 14:30:45
```

## Common Workflows

### Workflow 1: Store Research Findings

When a user shares a URL or asks to save information:

1. Create memory with descriptive name and content
2. Use hierarchical tags for organization
3. Include URL if available

```bash
curl -X POST $MEMORY_SERVER_URL/api/memories \
  -H "Content-Type: application/json" \
  -H "Accept: text/markdown" \
  -d '{
    "name": "TypeScript Best Practices",
    "content": "Type safety tips and patterns for TypeScript development",
    "url": "https://www.typescriptlang.org/docs/handbook/",
    "tags": ["programming>typescript", "best-practices", "documentation"]
  }'
```

### Workflow 2: Find Related Information

When a user asks about a topic:

1. Search memories with relevant keywords
2. Filter by appropriate tags
3. Present results in readable format

```bash
curl "$MEMORY_SERVER_URL/api/memories/search?query=TypeScript&tags=best-practices" \
  -H "Accept: text/markdown"
```

### Workflow 3: Organize Knowledge with Hierarchies

When building a knowledge structure:

1. Create parent tags for broad categories
2. Create child tags for specific topics
3. View the tag tree to verify structure

```bash
# Create hierarchy
curl -X POST "$MEMORY_SERVER_URL/api/tags/create-with-parent" \
  -H "Content-Type: application/json" \
  -d '{"child_tag_name": "react", "parent_tag_name": "frontend"}'

# View complete structure
curl "$MEMORY_SERVER_URL/api/tags/tree" \
  -H "Accept: text/markdown"
```

### Workflow 4: Update Stale Information

When information needs refreshing:

1. Search for the memory
2. Get the memory ID
3. Update with new content
4. Optionally add new tags

```bash
# Find the memory
MEMORY_ID=$(curl "$MEMORY_SERVER_URL/api/memories/search?query=React+Hooks" | jq -r '.data[0].id')

# Update it
curl -X PUT "$MEMORY_SERVER_URL/api/memories/$MEMORY_ID" \
  -H "Content-Type: application/json" \
  -H "Accept: text/markdown" \
  -d '{
    "name": "React Hooks Guide 2025",
    "content": "Updated comprehensive guide with latest hooks...",
    "tags": ["programming>javascript", "frontend>react", "tutorial", "2025"]
  }'
```

## Error Handling

All endpoints return error responses in both JSON and Markdown formats based on the `Accept` header.

**JSON Error Format**:
```json
{
  "success": false,
  "error": "Memory not found"
}
```

**Markdown Error Format**:
```markdown
# Error

Memory not found
```

## Best Practices

1. **Use Markdown Responses**: Request markdown format (`Accept: text/markdown`) for better readability in CLI output
2. **Organize with Hierarchies**: Use `parent>child` format when creating memories to maintain organized tag structures
3. **Descriptive Names**: Give memories clear, searchable names
4. **Rich Content**: Include comprehensive information in the content field
5. **Tag Strategically**: Use a mix of hierarchical and simple tags for flexible organization
6. **Pagination**: Use `limit` and `offset` parameters for large result sets
7. **URL References**: Always include source URLs when storing web content

## Environment Setup

Set the Memory Server URL as an environment variable for easy access:

```bash
# For local development
export MEMORY_SERVER_URL="http://localhost:8787"

# For production deployment
export MEMORY_SERVER_URL="https://your-worker.your-subdomain.workers.dev"
```

Then use `$MEMORY_SERVER_URL` in all curl commands as shown in the examples above.

## Troubleshooting

### Connection Issues
- Verify server is running: `curl $MEMORY_SERVER_URL/`
- Check firewall settings for local development
- Confirm Cloudflare Workers deployment status

### Authentication Errors
- Note: Current version runs without authentication
- Ensure you deploy in a secure environment for production use

### Invalid Responses
- Check `Accept` header is set correctly
- Verify `Content-Type: application/json` for POST/PUT requests
- Ensure JSON payload is properly formatted

### Tag Hierarchy Issues
- Verify both tags exist before creating relationships
- Check for circular references
- Use tag tree endpoint to visualize current structure

## Additional Resources

- Full project documentation: See README.md
- API architecture: See planning/memory-server/architect.md
- MCP integration: Use `/mcp` endpoint for Model Context Protocol access
- Manual testing guide: See taskNotes/rest-api-markdown-responses/manual-testing-guide.md
