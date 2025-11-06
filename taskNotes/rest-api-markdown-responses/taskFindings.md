# Purpose

Add markdown response format support to REST APIs with header-based content negotiation

## Original Ask

Update the rest APIs to accept the header, when it's present, we should be responding with markdown just like we respond with MCP tools

## Complexity and the reason behind it

**Complexity Score: 2/5**

**Reasoning:**
- Similar pattern to the completed MCP markdown responses implementation (complexity 2/5)
- Most markdown formatters already exist and can be reused
- Clear implementation pattern: header detection + conditional formatting
- Need to create a few new formatters for tag hierarchy endpoints
- 15 endpoint handlers to update (7 memory + 8 tag hierarchy)
- Middleware/utility approach will minimize code duplication
- Straightforward testing with HTTP clients
- No database schema changes required
- No breaking changes - JSON remains the default

## Architectural changes required

**No major architectural changes required.** This is a presentation layer enhancement that adds content negotiation capability to existing REST endpoints.

**Design Decision:**
- Use standard HTTP `Accept` header for content negotiation
  - `Accept: text/markdown` → Returns markdown response
  - `Accept: application/json` or no header → Returns JSON (default, backward compatible)
- Alternative custom header approach: `X-Response-Format: markdown`
- **Recommendation**: Use `Accept: text/markdown` as it follows HTTP standards

## Backend changes required

### 1. Create Response Utility Module

**File: `src/utils/responseFormatter.ts` (new file)**

Create a centralized utility for handling dual-format responses in REST APIs:

```typescript
/**
 * Utility to handle content negotiation for REST API responses
 * Supports both JSON and Markdown formats based on Accept header
 */

import { Context } from 'hono';
import type { Env } from '../index';

/**
 * Check if client prefers markdown format
 * Checks Accept header for text/markdown
 */
export function prefersMarkdown(c: Context): boolean {
  const acceptHeader = c.req.header('Accept') || '';
  return acceptHeader.includes('text/markdown');
}

/**
 * Send response in appropriate format based on Accept header
 * @param c - Hono context
 * @param markdownText - Markdown formatted content
 * @param jsonData - JSON structured data
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendFormattedResponse(
  c: Context,
  markdownText: string,
  jsonData: any,
  statusCode: number = 200
) {
  if (prefersMarkdown(c)) {
    return c.text(markdownText, statusCode, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  }

  return c.json(jsonData, statusCode);
}
```

### 2. Extend Formatters for Tag Hierarchy

**File: `src/mcp/utils/formatters.ts` (extend existing)**

Add new formatter functions for tag hierarchy responses:

```typescript
/**
 * Format tag hierarchy relationship as markdown
 */
export function formatTagRelationshipAsMarkdown(data: {
  child_tag: Tag;
  parent_tag: Tag;
  relationship_created?: boolean;
}): string {
  const markdown = `# Tag Relationship Created

**Parent Tag**: ${data.parent_tag.name} (ID: ${data.parent_tag.id})
**Child Tag**: ${data.child_tag.name} (ID: ${data.child_tag.id})

## Hierarchy
\`\`\`
${data.parent_tag.name}
└── ${data.child_tag.name}
\`\`\`

The hierarchical relationship has been established successfully.`;

  return markdown;
}

/**
 * Format tag tree as markdown
 */
export function formatTagTreeAsMarkdown(tree: TagNode[]): string {
  let markdown = `# Tag Hierarchy Tree

`;

  function renderTree(nodes: TagNode[], depth: number = 0): string {
    let result = '';
    const indent = '  '.repeat(depth);

    for (const node of nodes) {
      result += `${indent}- **${node.name}** (ID: ${node.id})`;

      if (node.children && node.children.length > 0) {
        result += '\n';
        result += renderTree(node.children, depth + 1);
      } else {
        result += '\n';
      }
    }

    return result;
  }

  if (tree.length === 0) {
    markdown += 'No tags found in the hierarchy.\n';
  } else {
    markdown += renderTree(tree);
  }

  return markdown;
}

/**
 * Format tag list (ancestors/descendants) as markdown
 */
export function formatTagListAsMarkdown(
  title: string,
  tags: Tag[],
  contextTag?: { id: number; name?: string }
): string {
  let markdown = `# ${title}

`;

  if (contextTag) {
    markdown += `Reference Tag: **${contextTag.name || `ID ${contextTag.id}`}**\n\n`;
  }

  if (tags.length === 0) {
    markdown += 'No tags found.\n';
  } else {
    markdown += `Found ${tags.length} tag${tags.length === 1 ? '' : 's'}:\n\n`;

    tags.forEach((tag, index) => {
      markdown += `${index + 1}. **${tag.name}** (ID: ${tag.id})\n`;
    });
  }

  return markdown;
}

/**
 * Format stats response as markdown
 */
export function formatStatsAsMarkdown(stats: {
  total: number;
  recent: number;
  tagged: number;
}): string {
  return `# Memory Statistics

- **Total Memories**: ${stats.total}
- **Recent Memories** (last 30 days): ${stats.recent}
- **Tagged Memories**: ${stats.tagged}
- **Untagged Memories**: ${stats.total - stats.tagged}

## Summary
${stats.total === 0 ? 'No memories stored yet.' : `You have ${stats.total} memories, with ${Math.round((stats.tagged / stats.total) * 100)}% tagged.`}`;
}
```

### 3. Update Memory Handlers

**File: `src/handlers/memory.ts`**

Update each handler to support markdown responses:

**Example pattern for createMemory:**
```typescript
import { sendFormattedResponse } from '../utils/responseFormatter';
import { formatMemoryAsMarkdown } from '../mcp/utils/formatters';

export async function createMemory(c: Context<{ Bindings: Env }>) {
  try {
    // ... existing logic to create memory ...

    const memory = await getMemoryById(c.env.DB, id);

    // Format response based on Accept header
    const markdown = formatMemoryAsMarkdown(memory);
    const jsonData = {
      success: true,
      data: memory
    };

    return sendFormattedResponse(c, markdown, jsonData, 201);

  } catch (error) {
    return handleMemoryError(error, c);
  }
}
```

**Handlers to update:**
1. `createMemory` - Use `formatMemoryAsMarkdown`
2. `getMemory` - Use `formatMemoryAsMarkdown`
3. `listMemories` - Use `formatMemoryListAsMarkdown`
4. `updateMemory` - Use `formatMemoryAsMarkdown`
5. `deleteMemory` - Use `formatSuccessResponse`
6. `getMemoryStats` - Use `formatStatsAsMarkdown` (new)
7. `findMemories` - Use `formatSearchResultsAsMarkdown`

### 4. Update Tag Hierarchy Handlers

**File: `src/handlers/tagHierarchy.ts`**

Update each handler to support markdown responses using new formatters:

**Handlers to update:**
1. `createTagsWithRelationship` - Use `formatTagRelationshipAsMarkdown` (new)
2. `addParent` - Use `formatSuccessResponse` with tag details
3. `removeParent` - Use `formatSuccessResponse`
4. `getAncestors` - Use `formatTagListAsMarkdown` (new)
5. `getDescendants` - Use `formatTagListAsMarkdown` (new)
6. `getImmediateParents` - Use `formatTagListAsMarkdown` (new)
7. `getImmediateChildren` - Use `formatTagListAsMarkdown` (new)
8. `getTagTree` - Use `formatTagTreeAsMarkdown` (new)

### 5. Update Error Handlers

Both error handlers (`handleMemoryError` and `handleTagHierarchyError`) need to support markdown:

```typescript
function handleMemoryError(error: unknown, c: Context<{ Bindings: Env }>) {
  // ... existing error detection logic ...

  if (prefersMarkdown(c)) {
    const markdown = formatErrorResponse(errorMessage, errorDetails);
    return c.text(markdown, statusCode, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  }

  return c.json({
    success: false,
    error: errorMessage
  }, statusCode);
}
```

## Frontend changes required

**No frontend changes required.** The React UI will continue using JSON responses by default. This is a backend API enhancement that doesn't affect the existing UI.

## Validation

### Testing Approach

#### 1. Unit Testing
- Test `prefersMarkdown()` function with various Accept header values
- Test each formatter function with sample data
- Verify markdown output format and structure

#### 2. Integration Testing with HTTP Clients

**Test each endpoint with both formats:**

**Memory Endpoints:**

```bash
# Test JSON response (default)
curl http://localhost:8787/api/memories \
  -H "Accept: application/json"

# Test Markdown response
curl http://localhost:8787/api/memories \
  -H "Accept: text/markdown"

# Test POST with markdown
curl -X POST http://localhost:8787/api/memories \
  -H "Accept: text/markdown" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "content": "Test content", "tags": ["test"]}'

# Test search with markdown
curl "http://localhost:8787/api/memories/search?query=test" \
  -H "Accept: text/markdown"

# Test stats with markdown
curl http://localhost:8787/api/memories/stats \
  -H "Accept: text/markdown"
```

**Tag Hierarchy Endpoints:**

```bash
# Test tag tree with markdown
curl http://localhost:8787/api/tags/tree \
  -H "Accept: text/markdown"

# Test create relationship with markdown
curl -X POST http://localhost:8787/api/tags/create-with-parent \
  -H "Accept: text/markdown" \
  -H "Content-Type: application/json" \
  -d '{"child_tag_name": "javascript", "parent_tag_name": "programming"}'

# Test ancestors with markdown
curl http://localhost:8787/api/tags/1/ancestors \
  -H "Accept: text/markdown"
```

#### 3. Backward Compatibility Testing

Verify that existing clients continue to work without changes:

```bash
# No Accept header should default to JSON
curl http://localhost:8787/api/memories

# Explicit JSON Accept header
curl http://localhost:8787/api/memories \
  -H "Accept: application/json"

# React UI should continue working without changes
npm run ui:dev
```

#### 4. Content-Type Verification

Verify response headers:

```bash
# Check markdown response has correct Content-Type
curl -I http://localhost:8787/api/memories \
  -H "Accept: text/markdown"

# Should return: Content-Type: text/markdown; charset=utf-8
```

### Validation Commands

```bash
# Start development server
npm run dev

# In separate terminal, run type checking
npm run type-check

# Test with curl or use Postman/Insomnia
# See integration testing examples above

# Optional: Create automated test suite
npm run test
```

### Manual Verification Steps

1. **Backward Compatibility Check**
   - Open React UI at http://localhost:8788
   - Verify all UI functionality works (it uses JSON)
   - Check browser network tab shows JSON responses

2. **Markdown Response Check**
   - Use curl/Postman with `Accept: text/markdown` header
   - Verify each endpoint returns readable markdown
   - Check Content-Type header is `text/markdown`
   - Verify markdown renders properly in tools that support it

3. **Edge Cases**
   - Empty result sets (no memories, no tags)
   - Error responses (404, 400, 500)
   - Large result sets with pagination
   - Special characters in content

4. **Format Consistency**
   - Compare markdown from REST API vs MCP tools
   - Verify similar endpoints use similar formatting
   - Check headers, lists, and metadata are consistent

### Success Criteria

- ✅ All 15 REST API endpoints support markdown responses
- ✅ Markdown format matches MCP tool response style and quality
- ✅ `Accept: text/markdown` header triggers markdown response
- ✅ Default behavior (JSON) remains unchanged (backward compatible)
- ✅ Content-Type headers are correctly set
- ✅ All formatters produce valid, readable markdown
- ✅ Error responses also support markdown format
- ✅ No breaking changes to existing JSON API
- ✅ React UI continues working without modifications
- ✅ TypeScript types are properly defined
- ✅ No type errors in type-check
- ✅ Dates are formatted consistently
- ✅ Empty/null values are handled gracefully
- ✅ Tag hierarchy visualizations are clear in markdown
- ✅ Statistics are presented in readable format
