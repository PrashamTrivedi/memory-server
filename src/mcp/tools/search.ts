import type { Env } from '../../index';
import { Memory } from '../../../types/index';
import { TemporaryMemoryService } from '../../services/temporaryMemory';
import { TagHierarchyService } from '../../services/tagHierarchy';
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

    // Search D1 (permanent memories)
    let d1Memories: Memory[] = [];
    if (query && tags && tags.length > 0) {
      const result = await searchMemoriesByQueryAndTags(env.DB, query, tags, 1000, 0);
      d1Memories = result.memories;
    } else if (query) {
      const result = await searchMemoriesByQuery(env.DB, query, 1000, 0);
      d1Memories = result.memories;
    } else if (tags && tags.length > 0) {
      const result = await searchMemoriesByTags(env.DB, tags, 1000, 0);
      d1Memories = result.memories;
    }

    // Search temporary memories in KV
    const tempMemories = await TemporaryMemoryService.search(env, query || '', tags);

    // Merge and sort by updated_at desc
    const allMemories = [...d1Memories, ...tempMemories].sort(
      (a, b) => b.updated_at - a.updated_at
    );

    const total = allMemories.length;

    // Apply pagination
    const paginated = allMemories.slice(offset, offset + limit);

    const pagination = {
      total,
      limit,
      offset,
      has_more: offset + limit < total
    };

    // Format as markdown
    const markdown = formatSearchResultsAsMarkdown(paginated, query, tags, pagination);
    const structuredData = {
      success: true,
      data: {
        memories: paginated,
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
 * Add tags to an existing memory (supports both permanent and temporary memories)
 */
export const addTagsTool: Tool = {
  name: 'add_tags',
  description: 'Add tags to an existing memory. Supports hierarchical tags in "parent>child" format.',
  inputSchema: {
    type: 'object',
    properties: {
      memoryId: {
        type: 'string',
        description: 'The UUID of the memory to add tags to',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to add to the memory. Supports hierarchical format "parent>child"',
        minItems: 1,
      },
    },
    required: ['memoryId', 'tags'],
  },
};

export async function handleAddTags(env: Env, args: any): Promise<any> {
  try {
    // Prefer memoryId (matches zod schema in server.ts), fallback to memory_id for backwards compatibility
    const memoryId = args.memoryId || args.memory_id;
    const tags = args.tags;

    if (!memoryId) {
      throw new Error('Memory ID is required');
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new Error('Tags array is required and must not be empty');
    }

    // Check if memory is temporary first
    const isTemporary = await TemporaryMemoryService.exists(env, memoryId);

    if (isTemporary) {
      // Handle temporary memory
      const tempMemory = await TemporaryMemoryService.get(env, memoryId);
      if (!tempMemory) {
        throw new Error(`Memory with ID ${memoryId} not found`);
      }

      // Process tags and merge with existing (upsert behavior)
      const existingTags = new Set(tempMemory.tags || []);
      const processedTags: string[] = [];

      for (const tag of tags) {
        if (!tag.trim()) continue;

        if (tag.includes('>')) {
          // Hierarchical tag - extract both parent and child
          const parts = tag.split('>').map((p: string) => p.trim()).filter(Boolean);
          if (parts.length === 2) {
            const [parent, child] = parts;
            processedTags.push(parent, child);
          }
        } else {
          processedTags.push(tag.trim());
        }
      }

      // Add new tags to existing (upsert - no duplicates)
      for (const tag of processedTags) {
        existingTags.add(tag);
      }

      // Update temporary memory with merged tags
      const updatedTags = Array.from(existingTags);
      const updated = await TemporaryMemoryService.update(env, memoryId, { tags: updatedTags });

      const markdown = formatMemoryAsMarkdown(updated!);
      const structuredData = {
        success: true,
        data: updated,
      };

      return createDualFormatResponse(markdown, structuredData);
    }

    // Permanent memory in D1
    const memory = await getMemoryById(env.DB, memoryId);
    if (!memory) {
      throw new Error(`Memory with ID ${memoryId} not found`);
    }

    // Add new tags with hierarchical support
    await assignTagsToMemoryWithHierarchy(env.DB, memoryId, tags);

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

/**
 * Escape a query string for SQLite FTS5 MATCH syntax.
 * FTS5 treats special characters like -, *, :, etc. as operators.
 * This function wraps each term in double quotes to treat them as literals.
 */
function escapeFtsQuery(query: string): string {
  // Split by whitespace, wrap each term in double quotes to escape special chars
  return query
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => `"${term.replace(/"/g, '""')}"`) // Escape internal quotes by doubling them
    .join(' ');
}

async function searchMemoriesByQuery(db: D1Database, query: string, limit: number, offset: number) {
  const escapedQuery = escapeFtsQuery(query);

  const stmt = db.prepare(`
    SELECT m.id, m.name, m.content, m.url, m.created_at, m.updated_at
    FROM memories_fts fts
    JOIN memories m ON m.rowid = fts.rowid
    WHERE memories_fts MATCH ?
    ORDER BY rank, m.updated_at DESC
    LIMIT ? OFFSET ?
  `);

  const result = await stmt.bind(escapedQuery, limit, offset).all<any>();
  
  // Get total count
  const countResult = await db.prepare(`
    SELECT COUNT(*) as count
    FROM memories_fts
    WHERE memories_fts MATCH ?
  `).bind(escapedQuery).first<{ count: number }>();
  
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
  const escapedQuery = escapeFtsQuery(query);
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

  const result = await stmt.bind(escapedQuery, ...tagNames, tagNames.length, limit, offset).all<any>();

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

  const countResult = await countStmt.bind(escapedQuery, ...tagNames, tagNames.length).first<{ count: number }>();
  
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

// assignTagsToMemory is no longer used - replaced by assignTagsToMemoryWithHierarchy

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
 * Assign tags to memory with hierarchical tag support
 * Supports "parent>child" format and creates tag relationships
 */
async function assignTagsToMemoryWithHierarchy(db: D1Database, memoryId: string, tagNames: string[]): Promise<void> {
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
    // Ignore duplicate key errors (upsert behavior)
    if (error instanceof Error && !error.message.includes('UNIQUE constraint failed')) {
      throw error;
    }
  }
}