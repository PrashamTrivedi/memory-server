import type { Env } from '../../index';
import { v4 as uuidv4 } from 'uuid';
import {
  Memory,
  CreateMemoryRequest
} from '../../../types/index';
import { TagHierarchyService } from '../../services/tagHierarchy';
import { TemporaryMemoryService } from '../../services/temporaryMemory';
import {
  formatMemoryAsMarkdown,
  formatMemoryListAsMarkdown,
  formatSuccessResponse,
  createDualFormatResponse
} from '../utils/formatters.js';

// Tool type definition
interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * MCP Tool: Add Memory
 * Creates a new memory with optional URL fetching
 */
export const addMemoryTool: Tool = {
  name: 'add_memory',
  description: 'Add a new memory to the server with optional URL content fetching',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name or title of the memory',
      },
      content: {
        type: 'string',
        description: 'Content of the memory',
      },
      url: {
        type: 'string',
        description: 'Optional URL to fetch content from',
        format: 'uri',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags to associate with the memory. Supports hierarchical format like "parent>child"',
      },
      temporary: {
        type: 'boolean',
        description: 'Create as temporary memory with TTL (auto-expires if not accessed, promotes to permanent after repeated access)',
      },
    },
    required: ['name', 'content'],
  },
};

export async function handleAddMemory(env: Env, args: any): Promise<any> {
  try {
    const request: CreateMemoryRequest = {
      name: args.name,
      content: args.content,
      url: args.url,
      tags: args.tags || [],
      temporary: args.temporary,
    };

    // Validate required fields
    if (!request.name || !request.content) {
      throw new Error('Missing required fields: name and content are required');
    }

    // Generate UUID for new memory
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    // Handle URL content fetching if URL provided
    let content = request.content;
    if (request.url) {
      const urlContent = await fetchUrlContent(env, request.url);
      if (urlContent) {
        content = `${request.content}\n\n--- URL Content ---\n${urlContent}`;
      }
    }

    let memory: Memory;

    if (request.temporary) {
      // Create temporary memory in KV
      const tempMemory: Memory = {
        id,
        name: request.name,
        content,
        url: request.url,
        tags: request.tags || [],
        created_at: now,
        updated_at: now,
      };
      await TemporaryMemoryService.create(env, tempMemory);
      memory = tempMemory;
    } else {
      // Insert permanent memory into database
      const stmt = env.DB.prepare(`
        INSERT INTO memories (id, name, content, url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(id, request.name, content, request.url || null, now, now).run();

      // Handle tags if provided
      if (request.tags && request.tags.length > 0) {
        await assignTagsToMemory(env.DB, id, request.tags);
      }

      // Fetch the created memory with tags
      const createdMemory = await getMemoryById(env.DB, id);
      memory = createdMemory!;
    }

    // Format as markdown
    const markdown = formatMemoryAsMarkdown(memory);
    const structuredData = {
      success: true,
      data: memory,
    };

    return createDualFormatResponse(markdown, structuredData);

  } catch (error) {
    throw new Error(`Failed to add memory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * MCP Tool: Get Memory
 * Retrieves a memory by its ID
 */
export const getMemoryTool: Tool = {
  name: 'get_memory',
  description: 'Retrieve a memory by its ID',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The UUID of the memory to retrieve',
      },
    },
    required: ['id'],
  },
};

export async function handleGetMemory(env: Env, args: any): Promise<any> {
  try {
    const id = args.id;

    if (!id) {
      throw new Error('Memory ID is required');
    }

    // First check temporary memories in KV (also handles TTL extension/promotion)
    const tempResult = await TemporaryMemoryService.handleAccess(env, id);
    if (tempResult.memory) {
      // Format as markdown
      const markdown = formatMemoryAsMarkdown(tempResult.memory);
      const structuredData = {
        success: true,
        data: tempResult.memory,
      };
      return createDualFormatResponse(markdown, structuredData);
    }

    // Fall back to D1 (permanent memories)
    const memory = await getMemoryById(env.DB, id);

    if (!memory) {
      throw new Error(`Memory with ID ${id} not found`);
    }

    // If memory has URL, check for updated content
    if (memory.url) {
      const urlContent = await fetchUrlContent(env, memory.url);
      if (urlContent && !memory.content.includes('--- URL Content ---')) {
        // Update memory with URL content if not already included
        const updatedContent = `${memory.content}\n\n--- URL Content ---\n${urlContent}`;
        await env.DB.prepare(`
          UPDATE memories SET content = ?, updated_at = ? WHERE id = ?
        `).bind(updatedContent, Math.floor(Date.now() / 1000), id).run();

        memory.content = updatedContent;
        memory.updated_at = Math.floor(Date.now() / 1000);
      }
    }

    // Format as markdown
    const markdown = formatMemoryAsMarkdown(memory);
    const structuredData = {
      success: true,
      data: memory,
    };

    return createDualFormatResponse(markdown, structuredData);

  } catch (error) {
    throw new Error(`Failed to get memory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * MCP Tool: List Memories
 * Lists memories with pagination
 */
export const listMemoriesTool: Tool = {
  name: 'list_memories',
  description: 'List all memories with pagination',
  inputSchema: {
    type: 'object',
    properties: {
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
  },
};

export async function handleListMemories(env: Env, args: any): Promise<any> {
  try {
    const limit = Math.min(args.limit || 10, 100);
    const offset = args.offset || 0;

    // Get permanent memories from D1
    const stmt = env.DB.prepare(`
      SELECT id, name, content, url, created_at, updated_at
      FROM memories
      ORDER BY updated_at DESC, created_at DESC
    `);

    const result = await stmt.all<any>();

    // Enrich D1 memories with tags
    const d1Memories: Memory[] = [];
    for (const row of result.results || []) {
      const tags = await getMemoryTags(env.DB, row.id);
      d1Memories.push({
        id: row.id,
        name: row.name,
        content: row.content,
        url: row.url || undefined,
        tags,
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    }

    // Get temporary memories from KV
    const tempMemories = await TemporaryMemoryService.listAll(env);

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
    const markdown = formatMemoryListAsMarkdown(paginated, pagination);
    const structuredData = {
      success: true,
      data: {
        memories: paginated,
        pagination
      }
    };

    return createDualFormatResponse(markdown, structuredData);

  } catch (error) {
    throw new Error(`Failed to list memories: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * MCP Tool: Delete Memory
 * Deletes a memory by its ID
 */
export const deleteMemoryTool: Tool = {
  name: 'delete_memory',
  description: 'Delete a memory by its ID',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The UUID of the memory to delete',
      },
    },
    required: ['id'],
  },
};

export async function handleDeleteMemory(env: Env, args: any): Promise<any> {
  try {
    const id = args.id;

    if (!id) {
      throw new Error('Memory ID is required');
    }

    // Try to delete from temporary memories first
    const deletedTemp = await TemporaryMemoryService.delete(env, id);
    if (deletedTemp) {
      const markdown = formatSuccessResponse(
        `Memory has been deleted successfully.`,
        { id }
      );
      const structuredData = {
        success: true,
        data: { deleted: true, id }
      };
      return createDualFormatResponse(markdown, structuredData);
    }

    // Fall back to D1 - verify memory exists
    const memory = await getMemoryById(env.DB, id);
    if (!memory) {
      throw new Error(`Memory with ID ${id} not found`);
    }

    // Delete memory (cascade will handle memory_tags)
    await env.DB.prepare('DELETE FROM memories WHERE id = ?').bind(id).run();

    // Format as markdown
    const markdown = formatSuccessResponse(
      `Memory "${memory.name}" has been deleted successfully.`,
      { id, name: memory.name }
    );
    const structuredData = {
      success: true,
      data: { deleted: true, id }
    };

    return createDualFormatResponse(markdown, structuredData);

  } catch (error) {
    throw new Error(`Failed to delete memory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * MCP Tool: Update URL Content
 * Updates the content of a memory by refetching its URL
 */
export const updateUrlContentTool: Tool = {
  name: 'update_url_content',
  description: 'Update the content of a memory by refetching its URL',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The UUID of the memory to update',
      },
      force: {
        type: 'boolean',
        description: 'Force refresh even if cached content exists',
        default: false,
      },
    },
    required: ['id'],
  },
};

export async function handleUpdateUrlContent(env: Env, args: any): Promise<any> {
  try {
    const id = args.id;
    const force = args.force || false;
    
    if (!id) {
      throw new Error('Memory ID is required');
    }

    // Get existing memory
    const memory = await getMemoryById(env.DB, id);
    if (!memory) {
      throw new Error(`Memory with ID ${id} not found`);
    }

    if (!memory.url) {
      throw new Error('Memory does not have a URL to update');
    }

    // Clear cache if force refresh requested
    if (force) {
      await env.CACHE_KV.delete(`url:${memory.url}`);
    }

    // Fetch updated URL content
    const urlContent = await fetchUrlContent(env, memory.url);
    if (!urlContent) {
      throw new Error('Failed to fetch content from URL');
    }

    // Extract original content (before URL content section)
    let originalContent = memory.content;
    const urlContentIndex = originalContent.indexOf('\n\n--- URL Content ---\n');
    if (urlContentIndex !== -1) {
      originalContent = originalContent.substring(0, urlContentIndex);
    }

    // Update memory with new content
    const updatedContent = `${originalContent}\n\n--- URL Content ---\n${urlContent}`;
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      UPDATE memories SET content = ?, updated_at = ? WHERE id = ?
    `).bind(updatedContent, now, id).run();

    // Return updated memory
    const updatedMemory = await getMemoryById(env.DB, id);

    // Format as markdown
    const markdown = formatMemoryAsMarkdown(updatedMemory!);
    const structuredData = {
      success: true,
      data: updatedMemory,
    };

    return createDualFormatResponse(markdown, structuredData);

  } catch (error) {
    throw new Error(`Failed to update URL content: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper functions (reused from memory handlers)

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
 * MCP Tool: Promote Memory
 * Promotes a temporary memory to permanent status
 */
export const promoteMemoryTool: Tool = {
  name: 'promote_memory',
  description: 'Promote a temporary memory to permanent status',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The UUID of the temporary memory to promote',
      },
    },
    required: ['id'],
  },
};

export async function handlePromoteMemory(env: Env, args: any): Promise<any> {
  try {
    const id = args.id;

    if (!id) {
      throw new Error('Memory ID is required');
    }

    // Check if exists as temporary
    const exists = await TemporaryMemoryService.exists(env, id);
    if (!exists) {
      // Check if already permanent
      const permanent = await getMemoryById(env.DB, id);
      if (permanent) {
        throw new Error('Memory is already permanent');
      }
      throw new Error(`Memory with ID ${id} not found`);
    }

    // Promote the memory
    const memory = await TemporaryMemoryService.promote(env, id);

    // Format as markdown
    const markdown = formatSuccessResponse(
      `Memory "${memory?.name}" has been promoted to permanent status.`,
      { id, name: memory?.name }
    );
    const structuredData = {
      success: true,
      data: { promoted: true, id, memory }
    };

    return createDualFormatResponse(markdown, structuredData);

  } catch (error) {
    throw new Error(`Failed to promote memory: ${error instanceof Error ? error.message : String(error)}`);
  }
}