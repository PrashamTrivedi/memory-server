import type { Memory, TemporaryMemoryWithMetadata } from '../../../types/index.js';

/**
 * MCP Tool Response Content Item
 */
export interface MCPContentItem {
  type: 'text' | 'image' | 'resource';
  text?: string;
  mimeType?: string;
}

/**
 * MCP Tool Response
 */
export interface MCPToolResponse {
  content: MCPContentItem[];
}

/**
 * Pagination metadata
 */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Format unix timestamp to human-readable date
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Truncate content to specified length with ellipsis
 */
function truncateContent(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength).trim() + '...';
}

/**
 * Format a single memory as markdown
 *
 * Converts a Memory object into human-readable markdown format suitable
 * for AI agent interpretation. Includes memory content, metadata (ID, tags, URL),
 * and formatted timestamps.
 *
 * @param memory - Memory object to format
 * @returns Markdown-formatted string representation
 */
export function formatMemoryAsMarkdown(memory: Memory): string {
  const markdown = `# Memory: ${memory.name}

${memory.content}

## Metadata
- **ID**: ${memory.id}
- **Tags**: ${memory.tags.length > 0 ? memory.tags.join(', ') : 'None'}
- **URL**: ${memory.url || 'None'}
- **Created**: ${formatDate(memory.created_at)}
- **Updated**: ${formatDate(memory.updated_at)}`;

  return markdown;
}

/**
 * Format a list of memories as markdown with pagination
 *
 * Converts multiple Memory objects into a paginated markdown format.
 * Truncates content previews for readability and includes pagination metadata
 * to show result position and availability.
 *
 * @param memories - Array of Memory objects to format
 * @param pagination - Pagination metadata (total, offset, limit, has_more)
 * @returns Markdown-formatted string with memory list and pagination info
 */
export function formatMemoryListAsMarkdown(
  memories: Memory[],
  pagination: PaginationInfo
): string {
  const { total, offset, has_more } = pagination;
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + memories.length, total);

  let markdown = `# Memories

Showing ${memories.length} of ${total} memories

`;

  memories.forEach((memory, index) => {
    const contentPreview = truncateContent(memory.content, 150);
    const position = offset + index + 1;

    markdown += `## ${position}. ${memory.name}

${contentPreview}

- **ID**: ${memory.id}
- **Tags**: ${memory.tags.length > 0 ? memory.tags.join(', ') : 'None'}
- **Updated**: ${formatDate(memory.updated_at)}

---

`;
  });

  markdown += `## Pagination
- **Showing**: ${startIndex} to ${endIndex}
- **Total**: ${total}
- **Has More**: ${has_more ? 'Yes' : 'No'}`;

  return markdown;
}

/**
 * Format search results as markdown
 *
 * Converts search results into markdown format with query and tag filters displayed.
 * Similar to list formatting but emphasizes search context and criteria.
 * Handles no-results case gracefully.
 *
 * @param memories - Array of Memory objects matching search criteria
 * @param query - Optional full-text search query string
 * @param tags - Optional array of tag filters applied
 * @param pagination - Pagination metadata for result set
 * @returns Markdown-formatted search results with context
 */
export function formatSearchResultsAsMarkdown(
  memories: Memory[],
  query: string | undefined,
  tags: string[] | undefined,
  pagination: PaginationInfo
): string {
  const { total, offset, has_more } = pagination;
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + memories.length, total);

  let markdown = `# Search Results

`;

  if (query) {
    markdown += `**Query**: "${query}"\n`;
  }

  if (tags && tags.length > 0) {
    markdown += `**Tags**: [${tags.join(', ')}]\n`;
  }

  markdown += `\nFound **${total}** results\n\n`;

  if (memories.length === 0) {
    markdown += `No memories found matching the search criteria.\n`;
  } else {
    memories.forEach((memory, index) => {
      const contentPreview = truncateContent(memory.content, 200);
      const position = offset + index + 1;

      markdown += `### Result ${position}: ${memory.name}

${contentPreview}

- **ID**: ${memory.id}
- **Tags**: ${memory.tags.length > 0 ? memory.tags.join(', ') : 'None'}
- **URL**: ${memory.url || 'None'}
- **Updated**: ${formatDate(memory.updated_at)}

---

`;
    });

    markdown += `## Pagination
- **Showing**: ${startIndex} to ${endIndex}
- **Total**: ${total}
- **Has More**: ${has_more ? 'Yes' : 'No'}`;
  }

  return markdown;
}

/**
 * Format a success response as markdown
 *
 * Creates a success message with optional data details in markdown format.
 * Useful for action confirmations (create, delete, update) with relevant metadata.
 *
 * @param message - Success message to display
 * @param data - Optional data object with operation details
 * @returns Markdown-formatted success response
 */
export function formatSuccessResponse(message: string, data?: any): string {
  let markdown = `✅ Success

${message}`;

  if (data) {
    markdown += `\n\n## Details\n`;

    if (typeof data === 'object' && data !== null) {
      // Format object data as key-value pairs
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          markdown += `- **${key}**: ${JSON.stringify(value)}\n`;
        }
      });
    } else {
      markdown += `${JSON.stringify(data, null, 2)}`;
    }
  }

  return markdown;
}

/**
 * Format an error response as markdown
 *
 * Creates an error message with optional error details in markdown format.
 * Useful for communicating failures in a user-friendly way.
 *
 * @param error - Error message summarizing the issue
 * @param details - Optional detailed error information
 * @returns Markdown-formatted error response
 */
export function formatErrorResponse(error: string, details?: string): string {
  let markdown = `❌ Error

${error}`;

  if (details) {
    markdown += `\n\n## Details
${details}`;
  }

  return markdown;
}

/**
 * Create a dual-format MCP response with both markdown and structured JSON
 *
 * Response Format Strategy:
 * This implements a dual-format response pattern for optimal MCP tool integration
 * with AI language models and agents.
 *
 * 1. Markdown Format (First Content Item):
 *    - Human-readable output optimized for language model interpretation
 *    - Includes formatted headers, lists, and visual structure
 *    - Designed for direct inclusion in AI agent reasoning and responses
 *    - Provides clear context and data hierarchy
 *
 * 2. JSON Format (Second Content Item):
 *    - Structured machine-parsable data with full metadata
 *    - Preserves complete information (IDs, timestamps, pagination, etc.)
 *    - Enables programmatic access and integration with tools
 *    - Maintains data integrity for downstream processing
 *
 * Usage:
 * - Language models primarily interpret the markdown for understanding
 * - Tools can extract structured data from JSON for integration
 * - Both formats maintain consistency and complementary information
 *
 * @param markdownText - Human-readable markdown formatted response
 * @param structuredData - Complete structured data in object form
 * @returns MCPToolResponse with dual-format content items
 */
export function createDualFormatResponse(
  markdownText: string,
  structuredData: any
): MCPToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: markdownText
      },
      {
        type: 'text',
        text: JSON.stringify(structuredData, null, 2),
        mimeType: 'application/json'
      }
    ]
  };
}

/**
 * Tag interfaces for REST API markdown formatters
 */
export interface Tag {
  id: number;
  name: string;
}

export interface TagTreeNode {
  id: number;
  name: string;
  children: TagTreeNode[];
  parents?: TagTreeNode[];
}

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
export function formatTagTreeAsMarkdown(tree: TagTreeNode[]): string {
  let markdown = `# Tag Hierarchy Tree

`;

  function renderTree(nodes: TagTreeNode[], depth: number = 0): string {
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

/**
 * Format temporary memories list with lifecycle metadata for review endpoint
 *
 * Displays temporary memories sorted by urgency with full lifecycle status visible.
 * Used exclusively by the review/rescue interface to help users manage expiring memories.
 *
 * @param memories - Array of temporary memories with lifecycle metadata
 * @param pagination - Pagination metadata
 * @returns Markdown-formatted review list with urgency indicators
 */
export function formatTemporaryMemoriesAsMarkdown(
  memories: TemporaryMemoryWithMetadata[],
  pagination: PaginationInfo
): string {
  const { total, offset, has_more } = pagination;

  let markdown = `# Temporary Memories Review

**Total**: ${total} temporary memories
**Purpose**: Review and rescue memories before expiry

`;

  if (memories.length === 0) {
    markdown += `No temporary memories found.

All memories are permanent or none have been created yet.
`;
    return markdown;
  }

  memories.forEach((memory, index) => {
    const position = offset + index + 1;
    const urgency =
      memory.days_until_expiry <= 3
        ? '🔴 URGENT'
        : memory.days_until_expiry <= 7
          ? '🟡 Soon'
          : '🟢 Safe';

    const accessTarget = memory.stage === 1 ? 5 : 15;
    const progressText = `${memory.access_count}/${accessTarget} (${memory.stage === 1 ? 'to Stage 2' : 'to Permanent'})`;

    markdown += `## ${position}. ${memory.name}

${truncateContent(memory.content, 150)}

### Lifecycle Status
- **Stage**: ${memory.stage}/2
- **Access Count**: ${progressText}
- **Days Until Expiry**: ${memory.days_until_expiry} ${urgency}
- **Last Accessed**: ${formatDate(memory.last_accessed)}

### Memory Details
- **ID**: \`${memory.id}\`
- **Tags**: ${memory.tags.length > 0 ? memory.tags.join(', ') : 'None'}
- **Created**: ${formatDate(memory.created_at)}

💡 Use \`promote_memory\` or POST \`/api/memories/${memory.id}/promote\` to save permanently

---

`;
  });

  markdown += `## Pagination
- **Showing**: ${offset + 1} to ${Math.min(offset + memories.length, total)}
- **Total**: ${total}
- **Has More**: ${has_more ? 'Yes' : 'No'}`;

  return markdown;
}
