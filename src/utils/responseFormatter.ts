import { Context } from 'hono';

/**
 * Utility to handle content negotiation for REST API responses
 * Supports both JSON and Markdown formats based on Accept header
 */

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
    return c.text(markdownText, statusCode as any, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  }

  return c.json(jsonData, statusCode as any);
}
