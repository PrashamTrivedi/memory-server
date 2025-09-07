import type { Env } from '../../index';
import { Memory } from '../../../types/index';

// Resource type definition
interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * MCP Resource: Memory
 * Provides access to memory content via URI scheme
 */
export const memoryResource: Resource = {
  uri: 'memory://{id}',
  name: 'Memory Resource',
  description: 'Access memory content by ID through memory:// URI scheme',
  mimeType: 'application/json',
};

/**
 * Handle memory resource requests
 */
export async function handleMemoryResource(env: Env, uri: string): Promise<any> {
  try {
    // Parse memory ID from URI (memory://memory_id)
    const match = uri.match(/^memory:\/\/(.+)$/);
    if (!match) {
      throw new Error('Invalid memory URI format. Expected: memory://memory_id');
    }

    const memoryId = match[1];
    
    // Check cache first for performance
    const cacheKey = `memory_resource:${memoryId}`;
    const cached = await env.CACHE_KV.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get memory from database
    const memory = await getMemoryById(env.DB, memoryId);
    
    if (!memory) {
      throw new Error(`Memory with ID ${memoryId} not found`);
    }

    // If memory has URL, ensure content is up-to-date
    if (memory.url) {
      const urlContent = await fetchUrlContent(env, memory.url);
      if (urlContent && !memory.content.includes('--- URL Content ---')) {
        // Update memory with URL content if not already included
        const updatedContent = `${memory.content}\n\n--- URL Content ---\n${urlContent}`;
        await env.DB.prepare(`
          UPDATE memories SET content = ?, updated_at = ? WHERE id = ?
        `).bind(updatedContent, Math.floor(Date.now() / 1000), memoryId).run();
        
        memory.content = updatedContent;
        memory.updated_at = Math.floor(Date.now() / 1000);
      }
    }

    const resourceData = {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            id: memory.id,
            name: memory.name,
            content: memory.content,
            url: memory.url,
            tags: memory.tags,
            metadata: {
              created_at: memory.created_at,
              updated_at: memory.updated_at,
              created_date: new Date(memory.created_at * 1000).toISOString(),
              updated_date: new Date(memory.updated_at * 1000).toISOString(),
              has_url: !!memory.url,
              tag_count: memory.tags.length,
              content_length: memory.content.length
            }
          }, null, 2)
        }
      ]
    };

    // Cache for 5 minutes to improve performance
    await env.CACHE_KV.put(cacheKey, JSON.stringify(resourceData), { 
      expirationTtl: 5 * 60 
    });

    return resourceData;

  } catch (error) {
    throw new Error(`Failed to handle memory resource: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List available memory resources
 */
export async function listMemoryResources(env: Env): Promise<Resource[]> {
  try {
    // Get all memory IDs for resource listing
    const result = await env.DB.prepare(`
      SELECT id, name, updated_at
      FROM memories
      ORDER BY updated_at DESC
      LIMIT 100
    `).all<any>();

    const resources: Resource[] = [];
    
    for (const row of result.results || []) {
      resources.push({
        uri: `memory://${row.id}`,
        name: `Memory: ${row.name}`,
        description: `Memory content for "${row.name}"`,
        mimeType: 'application/json'
      });
    }

    return resources;

  } catch (error) {
    console.error('Failed to list memory resources:', error);
    return [];
  }
}

/**
 * Memory resource with different format options
 */
export const memoryTextResource: Resource = {
  uri: 'memory://{id}/text',
  name: 'Memory Text Resource',
  description: 'Access memory content as plain text',
  mimeType: 'text/plain',
};

/**
 * Handle memory text resource requests
 */
export async function handleMemoryTextResource(env: Env, uri: string): Promise<any> {
  try {
    // Parse memory ID from URI (memory://memory_id/text)
    const match = uri.match(/^memory:\/\/(.+)\/text$/);
    if (!match) {
      throw new Error('Invalid memory text URI format. Expected: memory://memory_id/text');
    }

    const memoryId = match[1];
    
    // Get memory from database
    const memory = await getMemoryById(env.DB, memoryId);
    
    if (!memory) {
      throw new Error(`Memory with ID ${memoryId} not found`);
    }

    const resourceData = {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `# ${memory.name}\n\n${memory.content}\n\n## Metadata\n- Tags: ${memory.tags.join(', ') || 'None'}\n- Created: ${new Date(memory.created_at * 1000).toLocaleString()}\n- Updated: ${new Date(memory.updated_at * 1000).toLocaleString()}${memory.url ? `\n- URL: ${memory.url}` : ''}`
        }
      ]
    };

    return resourceData;

  } catch (error) {
    throw new Error(`Failed to handle memory text resource: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper functions

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