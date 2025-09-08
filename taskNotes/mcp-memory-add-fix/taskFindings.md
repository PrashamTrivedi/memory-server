# Purpose

Fix failing memory addition via MCP tool endpoint

## Original Ask
Adding memory via MCP tool fails.

## Complexity and the reason behind it
Complexity score: 1 out of 5
- Based on triage analysis, the root cause is identified: Zod validator error "keyValidator._parse is not a function"
- This is a validation layer issue between the official MCP SDK and the tool handlers
- Simple fix involving schema validation compatibility

## Architectural changes required

None required, the architecture is sound.

## Backend changes required

**Root Cause (from triage + code comparison)**: The error "keyValidator._parse is not a function" occurs because of incorrect `inputSchema` format in tool registration.

**Current incorrect format (lines 49-54)**:
```typescript
inputSchema: {
  name: z.string().describe('Name or title of the memory'),
  content: z.string().describe('Content of the memory'),
  // ... more fields
},
```

**Correct format (from sample)**:
```typescript
inputSchema: { name: z.string(), content: z.string(), url: z.string().optional(), tags: z.array(z.string()).optional() }
```

1. **Schema Format Fix**: Update all tool registrations in `src/mcp/server.ts`
   - The `inputSchema` should be a direct object with Zod schemas as key-value pairs
   - Remove the nested object structure that's currently being used
   - Ensure all tools follow the same pattern

2. **Syntax Fix**: Add missing commas after `inputSchema` objects in tool registrations

## Frontend changes required

None required, this is purely a backend MCP server issue.

## Acceptance Criteria

Not applicable (complexity < 3)

## Validation

Test the MCP add_memory tool by:
1. Starting the dev server: `npm run dev`
2. Connect via MCP Inspector at http://localhost:8787/mcp
3. Call the add_memory tool with test data:
   ```json
   {
     "name": "Test Memory",
     "content": "Test content for memory",
     "tags": ["test", "mcp"]
   }
   ```
4. Verify memory is created and returned with ID
5. Check database to confirm memory is persisted
6. Test with optional URL parameter to ensure URL fetching works