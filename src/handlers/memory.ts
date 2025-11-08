import { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env } from '../index';
import {
  Memory,
  CreateMemoryRequest,
  UpdateMemoryRequest,
  MemoryRow
} from '../../types/index';
import { MemoryError, MemoryNotFoundError } from '../errors/memoryErrors';
import { TagHierarchyService } from '../services/tagHierarchy';
import { sendFormattedResponse, prefersMarkdown } from '../utils/responseFormatter';
import {
  formatMemoryAsMarkdown,
  formatMemoryListAsMarkdown,
  formatSearchResultsAsMarkdown,
  formatSuccessResponse,
  formatStatsAsMarkdown,
  formatErrorResponse
} from '../mcp/utils/formatters';

/**
 * Create a new memory
 * POST /api/memories
 */
export async function createMemory(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<CreateMemoryRequest>();
    
    // Validate required fields
    if (!body.name || !body.content) {
      return returnValidationError(c, 'Missing required fields: name and content are required');
    }

    // Generate UUID for new memory
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    
    // Handle URL content fetching if URL provided
    let content = body.content;
    if (body.url) {
      const urlContent = await fetchUrlContent(c.env, body.url);
      if (urlContent) {
        content = `${body.content}\n\n--- URL Content ---\n${urlContent}`;
      }
    }

    // Insert memory into database
    const stmt = c.env.DB.prepare(`
      INSERT INTO memories (id, name, content, url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(id, body.name, content, body.url || null, now, now).run();

    // Handle tags if provided
    if (body.tags && body.tags.length > 0) {
      await assignTagsToMemory(c.env.DB, id, body.tags);
    }

    // Fetch the created memory with tags
    const memory = await getMemoryById(c.env.DB, id);

    if (!memory) {
      throw new MemoryNotFoundError(id);
    }

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

/**
 * Get a memory by ID
 * GET /api/memories/:id
 */
export async function getMemory(c: Context<{ Bindings: Env }>) {
  try {
    const id = c.req.param('id');

    if (!id) {
      return returnValidationError(c, 'Memory ID is required');
    }

    const memory = await getMemoryById(c.env.DB, id);
    
    if (!memory) {
      throw new MemoryNotFoundError(id);
    }

    // If memory has URL, check for updated content
    if (memory.url) {
      const urlContent = await fetchUrlContent(c.env, memory.url);
      if (urlContent && !memory.content.includes('--- URL Content ---')) {
        // Update memory with URL content if not already included
        const updatedContent = `${memory.content}\n\n--- URL Content ---\n${urlContent}`;
        await c.env.DB.prepare(`
          UPDATE memories SET content = ?, updated_at = ? WHERE id = ?
        `).bind(updatedContent, Math.floor(Date.now() / 1000), id).run();
        
        memory.content = updatedContent;
        memory.updated_at = Math.floor(Date.now() / 1000);
      }
    }

    // Format response based on Accept header
    const markdown = formatMemoryAsMarkdown(memory);
    const jsonData = {
      success: true,
      data: memory
    };

    return sendFormattedResponse(c, markdown, jsonData);

  } catch (error) {
    return handleMemoryError(error, c);
  }
}

/**
 * List memories with pagination
 * GET /api/memories?limit=10&offset=0
 */
export async function listMemories(c: Context<{ Bindings: Env }>) {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Get memories with pagination
    const stmt = c.env.DB.prepare(`
      SELECT id, name, content, url, created_at, updated_at
      FROM memories
      ORDER BY updated_at DESC, created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const result = await stmt.bind(limit, offset).all<MemoryRow>();
    
    // Get total count
    const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM memories').first<{ count: number }>();
    const total = countResult?.count || 0;
    
    // Enrich memories with tags
    const memories: Memory[] = [];
    for (const row of result.results || []) {
      const tags = await getMemoryTags(c.env.DB, row.id);
      memories.push({
        id: row.id,
        name: row.name,
        content: row.content,
        url: row.url || undefined,
        tags,
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    }

    const pagination = {
      total,
      limit,
      offset,
      has_more: offset + limit < total
    };

    // Format response based on Accept header
    const markdown = formatMemoryListAsMarkdown(memories, pagination);
    const jsonData = {
      success: true,
      data: {
        memories,
        pagination
      }
    };

    return sendFormattedResponse(c, markdown, jsonData);

  } catch (error) {
    return handleMemoryError(error, c);
  }
}

/**
 * Update a memory
 * PUT /api/memories/:id
 */
export async function updateMemory(c: Context<{ Bindings: Env }>) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<UpdateMemoryRequest>();
    
    if (!id) {
      return c.json({
        success: false,
        error: 'Memory ID is required'
      }, 400);
    }

    // Verify memory exists
    const existingMemory = await getMemoryById(c.env.DB, id);
    if (!existingMemory) {
      throw new MemoryNotFoundError(id);
    }

    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    
    if (body.content !== undefined) {
      let content = body.content;
      
      // Handle URL content if URL is being updated
      if (body.url) {
        const urlContent = await fetchUrlContent(c.env, body.url);
        if (urlContent) {
          content = `${body.content}\n\n--- URL Content ---\n${urlContent}`;
        }
      }
      
      updates.push('content = ?');
      values.push(content);
    }
    
    if (body.url !== undefined) {
      updates.push('url = ?');
      values.push(body.url || null);
    }
    
    if (updates.length === 0 && !body.tags) {
      return returnValidationError(c, 'No fields to update');
    }

    // Update memory if there are field changes
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(Math.floor(Date.now() / 1000));
      values.push(id);
      
      const stmt = c.env.DB.prepare(`
        UPDATE memories SET ${updates.join(', ')} WHERE id = ?
      `);
      
      await stmt.bind(...values).run();
    }

    // Update tags if provided
    if (body.tags !== undefined) {
      // Remove existing tags
      await c.env.DB.prepare('DELETE FROM memory_tags WHERE memory_id = ?').bind(id).run();
      
      // Add new tags
      if (body.tags.length > 0) {
        await assignTagsToMemory(c.env.DB, id, body.tags);
      }
    }

    // Fetch updated memory
    const updatedMemory = await getMemoryById(c.env.DB, id);

    if (!updatedMemory) {
      throw new MemoryNotFoundError(id);
    }

    // Format response based on Accept header
    const markdown = formatMemoryAsMarkdown(updatedMemory);
    const jsonData = {
      success: true,
      data: updatedMemory
    };

    return sendFormattedResponse(c, markdown, jsonData);

  } catch (error) {
    return handleMemoryError(error, c);
  }
}

/**
 * Delete a memory
 * DELETE /api/memories/:id
 */
export async function deleteMemory(c: Context<{ Bindings: Env }>) {
  try {
    const id = c.req.param('id');

    if (!id) {
      return returnValidationError(c, 'Memory ID is required');
    }

    // Verify memory exists
    const memory = await getMemoryById(c.env.DB, id);
    if (!memory) {
      throw new MemoryNotFoundError(id);
    }

    // Delete memory (cascade will handle memory_tags)
    await c.env.DB.prepare('DELETE FROM memories WHERE id = ?').bind(id).run();

    // Format response based on Accept header
    const markdown = formatSuccessResponse(`Memory deleted successfully`, { id, deleted: true });
    const jsonData = {
      success: true,
      data: { deleted: true, id }
    };

    return sendFormattedResponse(c, markdown, jsonData);

  } catch (error) {
    return handleMemoryError(error, c);
  }
}

/**
 * Get memory statistics
 * GET /api/memories/stats
 */
export async function getMemoryStats(c: Context<{ Bindings: Env }>) {
  try {
    // Get total count
    const totalResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM memories').first<{ count: number }>();
    const total = totalResult?.count || 0;
    
    // Get recent count (last 30 days)
    const thirtyDaysAgo = Math.floor((Date.now() - (30 * 24 * 60 * 60 * 1000)) / 1000);
    const recentResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM memories WHERE created_at > ?').bind(thirtyDaysAgo).first<{ count: number }>();
    const recent = recentResult?.count || 0;
    
    // Get tagged count
    const taggedResult = await c.env.DB.prepare('SELECT COUNT(DISTINCT memory_id) as count FROM memory_tags').first<{ count: number }>();
    const tagged = taggedResult?.count || 0;

    const stats = {
      total,
      recent,
      tagged
    };

    // Format response based on Accept header
    const markdown = formatStatsAsMarkdown(stats);
    const jsonData = {
      success: true,
      data: stats
    };

    return sendFormattedResponse(c, markdown, jsonData);

  } catch (error) {
    return handleMemoryError(error, c);
  }
}

/**
 * Search memories using FTS
 * GET /api/memories/search?query=term&tags=tag1,tag2&limit=10&offset=0
 */
export async function findMemories(c: Context<{ Bindings: Env }>) {
  try {
    const query = c.req.query('query');
    const tagsParam = c.req.query('tags');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);
    const offset = parseInt(c.req.query('offset') || '0');
    
    if (!query && !tagsParam) {
      return returnValidationError(c, 'Either query or tags parameter is required');
    }

    let memories: Memory[] = [];
    let total = 0;
    
    if (query && tagsParam) {
      // Search by both text and tags
      const tags = tagsParam.split(',').map((t: string) => t.trim()).filter(Boolean);
      const result = await searchMemoriesByQueryAndTags(c.env.DB, query, tags, limit, offset);
      memories = result.memories;
      total = result.total;
    } else if (query) {
      // Search by text only
      const result = await searchMemoriesByQuery(c.env.DB, query, limit, offset);
      memories = result.memories;
      total = result.total;
    } else if (tagsParam) {
      // Search by tags only
      const tags = tagsParam.split(',').map((t: string) => t.trim()).filter(Boolean);
      const result = await searchMemoriesByTags(c.env.DB, tags, limit, offset);
      memories = result.memories;
      total = result.total;
    }

    const pagination = {
      total,
      limit,
      offset,
      has_more: offset + limit < total
    };

    const tags = tagsParam ? tagsParam.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined;

    // Format response based on Accept header
    const markdown = formatSearchResultsAsMarkdown(memories, query, tags, pagination);
    const jsonData = {
      success: true,
      data: {
        memories,
        pagination,
        query: query || undefined,
        tags
      }
    };

    return sendFormattedResponse(c, markdown, jsonData);

  } catch (error) {
    return handleMemoryError(error, c);
  }
}

// Helper functions

/**
 * Fetch content from URL using browser rendering
 */
async function fetchUrlContent(env: Env, url: string): Promise<string | null> {
  try {
    // Check cache first
    const cached = await env.CACHE_KV.get(`url:${url}`);
    if (cached) {
      return cached;
    }

    // Fetch using browser
    const response = await env.BROWSER.fetch('https://chrome-browser.example.com/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        action: 'content',
        options: {
          waitFor: 'networkidle',
          timeout: 10000
        }
      })
    });

    if (response.ok) {
      const result = await response.json<{ content?: string }>();
      const content = result.content;
      
      if (content) {
        // Cache for 5 days
        await env.CACHE_KV.put(`url:${url}`, content, { expirationTtl: 5 * 24 * 60 * 60 });
        return content;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch URL content:', error);
    return null;
  }
}

/**
 * Get memory by ID with tags
 */
async function getMemoryById(db: D1Database, id: string): Promise<Memory | null> {
  const stmt = db.prepare(`
    SELECT id, name, content, url, created_at, updated_at
    FROM memories
    WHERE id = ?
  `);
  
  const row = await stmt.bind(id).first<MemoryRow>();
  
  if (!row) {
    return null;
  }
  
  const tags = await getMemoryTags(db, id);
  
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    url: row.url || undefined,
    tags,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Get tags for a memory
 */
async function getMemoryTags(db: D1Database, memoryId: string): Promise<string[]> {
  const stmt = db.prepare(`
    SELECT t.name
    FROM tags t
    JOIN memory_tags mt ON t.id = mt.tag_id
    WHERE mt.memory_id = ?
    ORDER BY t.name
  `);
  
  const result = await stmt.bind(memoryId).all<{ name: string }>();
  return result.results?.map(r => r.name) || [];
}

/**
 * Assign tags to memory with hierarchical tag support
 * Supports both simple tags and hierarchical format like "parent>child"
 */
async function assignTagsToMemory(db: D1Database, memoryId: string, tagNames: string[]): Promise<void> {
  for (const tagName of tagNames) {
    if (!tagName.trim()) continue;
    
    // Check if tag has hierarchical format (parent>child)
    if (tagName.includes('>')) {
      await processHierarchicalTag(db, memoryId, tagName.trim());
    } else {
      // Process simple tag
      const tagId = await getOrCreateTag(db, tagName.trim());
      await linkTagToMemory(db, memoryId, tagId);
    }
  }
}

/**
 * Process hierarchical tag in format "parent>child"
 */
async function processHierarchicalTag(db: D1Database, memoryId: string, hierarchicalTag: string): Promise<void> {
  const parts = hierarchicalTag.split('>').map(part => part.trim()).filter(Boolean);
  
  if (parts.length !== 2) {
    throw new Error(`Invalid hierarchical tag format: "${hierarchicalTag}". Expected format: "parent>child"`);
  }

  const [parentTagName, childTagName] = parts;

  try {
    // Use the service to create tags with relationship
    const result = await TagHierarchyService.createTagsWithRelationship(
      db,
      childTagName,
      parentTagName
    );

    // Link both tags to the memory
    await linkTagToMemory(db, memoryId, result.child_tag.id);
    await linkTagToMemory(db, memoryId, result.parent_tag.id);

  } catch (error) {
    // If relationship already exists, still link the tags to memory
    if (error instanceof Error && error.message.includes('already exists')) {
      // Get the existing tags and link them
      const childTag = await TagHierarchyService.getTagByName(db, childTagName);
      const parentTag = await TagHierarchyService.getTagByName(db, parentTagName);
      
      if (childTag) await linkTagToMemory(db, memoryId, childTag.id);
      if (parentTag) await linkTagToMemory(db, memoryId, parentTag.id);
    } else {
      throw error;
    }
  }
}

/**
 * Link tag to memory with duplicate handling
 */
async function linkTagToMemory(db: D1Database, memoryId: string, tagId: number): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO memory_tags (memory_id, tag_id)
      VALUES (?, ?)
    `).bind(memoryId, tagId).run();
  } catch (error) {
    // Ignore duplicate key errors
    if (error instanceof Error && !error.message.includes('UNIQUE constraint failed')) {
      throw error;
    }
  }
}

/**
 * Get or create tag
 */
async function getOrCreateTag(db: D1Database, tagName: string): Promise<number> {
  // Try to get existing tag
  const existing = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first<{ id: number }>();
  
  if (existing) {
    return existing.id;
  }
  
  // Create new tag
  const result = await db.prepare('INSERT INTO tags (name) VALUES (?)').bind(tagName).run();
  return result.meta.last_row_id as number;
}

/**
 * Process search query to support partial word matching
 * Adds wildcards to each word to enable prefix search
 */
function processSearchQuery(query: string): string {
  // Split query into words and process each
  const words = query.trim().split(/\s+/);
  
  // Add wildcard to each word for prefix matching
  // Also escape special FTS5 characters
  const processedWords = words.map(word => {
    // Remove existing wildcards to avoid double wildcarding
    const cleanWord = word.replace(/\*/g, '');
    
    // Skip empty words
    if (!cleanWord) return '';
    
    // Escape special FTS5 characters (quotes)
    const escapedWord = cleanWord.replace(/"/g, '""');
    
    // Add wildcard for prefix matching
    return `${escapedWord}*`;
  }).filter(Boolean);
  
  // Join with spaces for FTS5 query
  return processedWords.join(' ');
}

/**
 * Search memories by query using FTS
 */
async function searchMemoriesByQuery(db: D1Database, query: string, limit: number, offset: number) {
  // Process query to support partial word matching
  const processedQuery = processSearchQuery(query);
  
  const stmt = db.prepare(`
    SELECT m.id, m.name, m.content, m.url, m.created_at, m.updated_at
    FROM memories_fts fts
    JOIN memories m ON m.rowid = fts.rowid
    WHERE memories_fts MATCH ?
    ORDER BY rank, m.updated_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const result = await stmt.bind(processedQuery, limit, offset).all<MemoryRow>();
  
  // Get total count
  const countResult = await db.prepare(`
    SELECT COUNT(*) as count
    FROM memories_fts
    WHERE memories_fts MATCH ?
  `).bind(processedQuery).first<{ count: number }>();
  
  const memories: Memory[] = [];
  for (const row of result.results || []) {
    const tags = await getMemoryTags(db, row.id);
    memories.push({
      id: row.id,
      name: row.name,
      content: row.content,
      url: row.url || undefined,
      tags,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  }
  
  return {
    memories,
    total: countResult?.count || 0
  };
}

/**
 * Search memories by tags
 */
async function searchMemoriesByTags(db: D1Database, tagNames: string[], limit: number, offset: number) {
  const placeholders = tagNames.map(() => '?').join(',');
  
  const stmt = db.prepare(`
    SELECT DISTINCT m.id, m.name, m.content, m.url, m.created_at, m.updated_at
    FROM memories m
    JOIN memory_tags mt ON m.id = mt.memory_id
    JOIN tags t ON mt.tag_id = t.id
    WHERE t.name IN (${placeholders})
    GROUP BY m.id
    HAVING COUNT(DISTINCT t.id) = ?
    ORDER BY m.updated_at DESC, m.created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const result = await stmt.bind(...tagNames, tagNames.length, limit, offset).all<MemoryRow>();
  
  // Get total count
  const countStmt = db.prepare(`
    SELECT COUNT(DISTINCT m.id) as count
    FROM memories m
    JOIN memory_tags mt ON m.id = mt.memory_id
    JOIN tags t ON mt.tag_id = t.id
    WHERE t.name IN (${placeholders})
    GROUP BY m.id
    HAVING COUNT(DISTINCT t.id) = ?
  `);
  
  const countResult = await countStmt.bind(...tagNames, tagNames.length).first<{ count: number }>();
  
  const memories: Memory[] = [];
  for (const row of result.results || []) {
    const tags = await getMemoryTags(db, row.id);
    memories.push({
      id: row.id,
      name: row.name,
      content: row.content,
      url: row.url || undefined,
      tags,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  }
  
  return {
    memories,
    total: countResult?.count || 0
  };
}

/**
 * Search memories by both query and tags
 */
async function searchMemoriesByQueryAndTags(db: D1Database, query: string, tagNames: string[], limit: number, offset: number) {
  const placeholders = tagNames.map(() => '?').join(',');
  
  // Process query to support partial word matching
  const processedQuery = processSearchQuery(query);
  
  const stmt = db.prepare(`
    SELECT DISTINCT m.id, m.name, m.content, m.url, m.created_at, m.updated_at
    FROM memories_fts fts
    JOIN memories m ON m.rowid = fts.rowid
    JOIN memory_tags mt ON m.id = mt.memory_id
    JOIN tags t ON mt.tag_id = t.id
    WHERE memories_fts MATCH ? AND t.name IN (${placeholders})
    GROUP BY m.id
    HAVING COUNT(DISTINCT t.id) = ?
    ORDER BY rank, m.updated_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const result = await stmt.bind(processedQuery, ...tagNames, tagNames.length, limit, offset).all<MemoryRow>();
  
  // Get total count
  const countStmt = db.prepare(`
    SELECT COUNT(DISTINCT m.id) as count
    FROM memories_fts fts
    JOIN memories m ON m.rowid = fts.rowid
    JOIN memory_tags mt ON m.id = mt.memory_id
    JOIN tags t ON mt.tag_id = t.id
    WHERE memories_fts MATCH ? AND t.name IN (${placeholders})
    GROUP BY m.id
    HAVING COUNT(DISTINCT t.id) = ?
  `);
  
  const countResult = await countStmt.bind(processedQuery, ...tagNames, tagNames.length).first<{ count: number }>();
  
  const memories: Memory[] = [];
  for (const row of result.results || []) {
    const tags = await getMemoryTags(db, row.id);
    memories.push({
      id: row.id,
      name: row.name,
      content: row.content,
      url: row.url || undefined,
      tags,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  }
  
  return {
    memories,
    total: countResult?.count || 0
  };
}

/**
 * Return validation error with proper content negotiation
 */
function returnValidationError(c: Context<{ Bindings: Env }>, errorMessage: string, statusCode: number = 400) {
  if (prefersMarkdown(c)) {
    const markdown = formatErrorResponse(errorMessage);
    return c.text(markdown, statusCode, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  }

  return c.json({
    success: false,
    error: errorMessage
  }, statusCode);
}

/**
 * Centralized error handling for memory operations
 */
function handleMemoryError(error: unknown, c: Context<{ Bindings: Env }>) {
  console.error('Memory operation error:', error);

  let errorMessage = 'Internal server error';
  let statusCode = 500;

  if (error instanceof MemoryError) {
    errorMessage = error.message;
    statusCode = error.statusCode as any;
  } else if (error instanceof Error) {
    // Handle database constraint violations
    if (error.message.includes('UNIQUE constraint failed') && error.message.includes('memories.name')) {
      errorMessage = 'A memory with this name already exists';
      statusCode = 409;
    } else if (error.message.includes('FOREIGN KEY constraint failed')) {
      errorMessage = 'Invalid reference to related data';
      statusCode = 400;
    }
  }

  // Format response based on Accept header
  if (prefersMarkdown(c)) {
    const markdown = formatErrorResponse(errorMessage);
    return c.text(markdown, statusCode, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  }

  return c.json({
    success: false,
    error: errorMessage
  }, statusCode);
}