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

/**
 * Create a new memory
 * POST /api/memories
 */
export async function createMemory(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<CreateMemoryRequest>();
    
    // Validate required fields
    if (!body.name || !body.content) {
      return c.json({
        success: false,
        error: 'Missing required fields: name and content are required'
      }, 400);
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
    
    return c.json({
      success: true,
      data: memory
    }, 201);

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
      return c.json({
        success: false,
        error: 'Memory ID is required'
      }, 400);
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

    return c.json({
      success: true,
      data: memory
    });

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
    
    return c.json({
      success: true,
      data: {
        memories,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total
        }
      }
    });

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
      return c.json({
        success: false,
        error: 'No fields to update'
      }, 400);
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
    
    return c.json({
      success: true,
      data: updatedMemory
    });

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
      return c.json({
        success: false,
        error: 'Memory ID is required'
      }, 400);
    }

    // Verify memory exists
    const memory = await getMemoryById(c.env.DB, id);
    if (!memory) {
      throw new MemoryNotFoundError(id);
    }

    // Delete memory (cascade will handle memory_tags)
    await c.env.DB.prepare('DELETE FROM memories WHERE id = ?').bind(id).run();

    return c.json({
      success: true,
      data: { deleted: true, id }
    });

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
    
    return c.json({
      success: true,
      data: {
        total,
        recent,
        tagged
      }
    });
    
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
      return c.json({
        success: false,
        error: 'Either query or tags parameter is required'
      }, 400);
    }

    let memories: Memory[] = [];
    let total = 0;
    
    if (query && tagsParam) {
      // Search by both text and tags
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean);
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
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean);
      const result = await searchMemoriesByTags(c.env.DB, tags, limit, offset);
      memories = result.memories;
      total = result.total;
    }
    
    return c.json({
      success: true,
      data: {
        memories,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total
        },
        query: query || undefined,
        tags: tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : undefined
      }
    });

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
 * Assign tags to memory
 */
async function assignTagsToMemory(db: D1Database, memoryId: string, tagNames: string[]): Promise<void> {
  for (const tagName of tagNames) {
    if (!tagName.trim()) continue;
    
    // Get or create tag
    let tagId = await getOrCreateTag(db, tagName.trim());
    
    // Link memory to tag
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
 * Centralized error handling for memory operations
 */
function handleMemoryError(error: unknown, c: Context<{ Bindings: Env }>) {
  console.error('Memory operation error:', error);

  if (error instanceof MemoryError) {
    return c.json({
      success: false,
      error: error.message
    }, error.statusCode as any);
  }

  // Handle database constraint violations
  if (error instanceof Error) {
    if (error.message.includes('UNIQUE constraint failed') && error.message.includes('memories.name')) {
      return c.json({
        success: false,
        error: 'A memory with this name already exists'
      }, 409);
    }

    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({
        success: false,
        error: 'Invalid reference to related data'
      }, 400);
    }
  }

  // Generic error fallback
  return c.json({
    success: false,
    error: 'Internal server error'
  }, 500);
}