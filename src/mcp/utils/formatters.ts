import type { Memory } from '../../../types/index.js';

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
 * This provides:
 * 1. Human-readable markdown text for AI agents and humans
 * 2. Machine-parsable JSON for programmatic access
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
