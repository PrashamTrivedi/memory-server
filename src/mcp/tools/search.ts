import type { Env } from '../../index';
import { Memory } from '../../../types/index';
import {
  formatSearchResultsAsMarkdown,
  formatMemoryAsMarkdown,
  createDualFormatResponse
} from '../utils/formatters.js';

// Tool type definition
interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * MCP Tool: Find Memories
 * Search memories using FTS and tag filtering
 */
export const findMemoriesTool: Tool = {
  name: 'find_memories',
  description: 'Search memories using full-text search and tag filtering',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Text query for full-text search',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to filter by (AND logic - memory must have all tags)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of memories to return (max 100)',
        default: 10,
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Number of memories to skip for pagination',
        default: 0,
        minimum: 0,
      },
    },
    anyOf: [
      { required: ['query'] },
      { required: ['tags'] }
    ],
  },
};

export async function handleFindMemories(env: Env, args: any): Promise<any> {
  try {
    const query = args.query;
    const tags = args.tags;
    const limit = Math.min(args.limit || 10, 100);
    const offset = args.offset || 0;
    
    if (!query && !tags) {
      throw new Error('Either query or tags parameter is required');
    }

    let memories: Memory[] = [];
    let total = 0;

    if (query && tags && tags.length > 0) {
      // Search by both text and tags
      const result = await searchMemoriesByQueryAndTags(env.DB, query, tags, limit, offset);
      memories = result.memories;
      total = result.total;
    } else if (query) {
      // Search by text only
      const result = await searchMemoriesByQuery(env.DB, query, limit, offset);
      memories = result.memories;
      total = result.total;
    } else if (tags && tags.length > 0) {
      // Search by tags only
      const result = await searchMemoriesByTags(env.DB, tags, limit, offset);
      memories = result.memories;
      total = result.total;
    }

    const pagination = {
      total,
      limit,
      offset,
      has_more: offset + limit < total
    };

    // Format as markdown
    const markdown = formatSearchResultsAsMarkdown(memories, query, tags, pagination);
    const structuredData = {
      success: true,
      data: {
        memories,
        pagination,
        query: query || undefined,
        tags: tags || undefined
      }
    };

    return createDualFormatResponse(markdown, structuredData);

  } catch (error) {
    throw new Error(`Failed to find memories: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * MCP Tool: Add Tags
 * Add tags to an existing memory
 */
export const addTagsTool: Tool = {
  name: 'add_tags',
  description: 'Add tags to an existing memory',
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'The UUID of the memory to add tags to',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to add to the memory',
        minItems: 1,
      },
    },
    required: ['memory_id', 'tags'],
  },
};

export async function handleAddTags(env: Env, args: any): Promise<any> {
  try {
    const memoryId = args.memory_id;
    const tags = args.tags;
    
    if (!memoryId) {
      throw new Error('Memory ID is required');
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new Error('Tags array is required and must not be empty');
    }

    // Verify memory exists
    const memory = await getMemoryById(env.DB, memoryId);
    if (!memory) {
      throw new Error(`Memory with ID ${memoryId} not found`);
    }

    // Add new tags to existing tags
    await assignTagsToMemory(env.DB, memoryId, tags);

    // Update memory timestamp
    await env.DB.prepare(`
      UPDATE memories SET updated_at = ? WHERE id = ?
    `).bind(Math.floor(Date.now() / 1000), memoryId).run();

    // Return updated memory with all tags
    const updatedMemory = await getMemoryById(env.DB, memoryId);

    // Format as markdown
    const markdown = formatMemoryAsMarkdown(updatedMemory!);
    const structuredData = {
      success: true,
      data: updatedMemory,
    };

    return createDualFormatResponse(markdown, structuredData);

  } catch (error) {
    throw new Error(`Failed to add tags: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper functions

async function searchMemoriesByQuery(db: D1Database, query: string, limit: number, offset: number) {
  const stmt = db.prepare(`
    SELECT m.id, m.name, m.content, m.url, m.created_at, m.updated_at
    FROM memories_fts fts
    JOIN memories m ON m.rowid = fts.rowid
    WHERE memories_fts MATCH ?
    ORDER BY rank, m.updated_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const result = await stmt.bind(query, limit, offset).all<any>();
  
  // Get total count
  const countResult = await db.prepare(`
    SELECT COUNT(*) as count
    FROM memories_fts
    WHERE memories_fts MATCH ?
  `).bind(query).first<{ count: number }>();
  
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
  
  const result = await stmt.bind(...tagNames, tagNames.length, limit, offset).all<any>();
  
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

async function searchMemoriesByQueryAndTags(db: D1Database, query: string, tagNames: string[], limit: number, offset: number) {
  const placeholders = tagNames.map(() => '?').join(',');
  
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
  
  const result = await stmt.bind(query, ...tagNames, tagNames.length, limit, offset).all<any>();
  
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
  
  const countResult = await countStmt.bind(query, ...tagNames, tagNames.length).first<{ count: number }>();
  
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

async function getMemoryById(db: D1Database, id: string): Promise<Memory | null> {
  const stmt = db.prepare(`
    SELECT id, name, content, url, created_at, updated_at
    FROM memories
    WHERE id = ?
  `);
  
  const row = await stmt.bind(id).first<any>();
  
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