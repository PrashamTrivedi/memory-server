import type { Env, Memory, TemporaryMemory } from '../../types';

const TTL_14_DAYS = 14 * 24 * 60 * 60; // 1,209,600 seconds
const TTL_28_DAYS = 28 * 24 * 60 * 60; // 2,419,200 seconds
const TEMP_MEMORY_PREFIX = 'temp_memory:';

export class TemporaryMemoryService {
  /**
   * Create a new temporary memory in KV
   */
  static async create(env: Env, memory: Memory): Promise<TemporaryMemory> {
    const tempMemory: TemporaryMemory = {
      ...memory,
      extension_count: 0,
    };

    await env.TEMP_MEMORIES_KV.put(
      `${TEMP_MEMORY_PREFIX}${memory.id}`,
      JSON.stringify(tempMemory),
      { expirationTtl: TTL_14_DAYS }
    );

    return tempMemory;
  }

  /**
   * Get a temporary memory by ID
   * Returns null if not found or expired
   */
  static async get(env: Env, id: string): Promise<TemporaryMemory | null> {
    const data = await env.TEMP_MEMORIES_KV.get(`${TEMP_MEMORY_PREFIX}${id}`);
    if (!data) return null;
    return JSON.parse(data) as TemporaryMemory;
  }

  /**
   * Handle memory access - extend TTL or promote to permanent
   * Returns { promoted: boolean, memory: Memory | null }
   */
  static async handleAccess(
    env: Env,
    id: string
  ): Promise<{ promoted: boolean; memory: Memory | null }> {
    const tempMemory = await this.get(env, id);
    if (!tempMemory) {
      return { promoted: false, memory: null };
    }

    if (tempMemory.extension_count >= 2) {
      // Promote to permanent
      const promoted = await this.promote(env, id);
      return { promoted: true, memory: promoted };
    }

    // Extend TTL and increment counter
    const updated: TemporaryMemory = {
      ...tempMemory,
      extension_count: tempMemory.extension_count + 1,
      updated_at: Math.floor(Date.now() / 1000),
    };

    await env.TEMP_MEMORIES_KV.put(
      `${TEMP_MEMORY_PREFIX}${id}`,
      JSON.stringify(updated),
      { expirationTtl: TTL_28_DAYS }
    );

    const { extension_count, ...memory } = updated;
    return { promoted: false, memory };
  }

  /**
   * Promote a temporary memory to permanent (insert to D1, delete from KV)
   */
  static async promote(env: Env, id: string): Promise<Memory | null> {
    const tempMemory = await this.get(env, id);
    if (!tempMemory) return null;

    const { extension_count, ...memory } = tempMemory;
    const now = Math.floor(Date.now() / 1000);

    // Insert into D1
    await env.DB.prepare(
      `
      INSERT INTO memories (id, name, content, url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        memory.id,
        memory.name,
        memory.content,
        memory.url || null,
        memory.created_at,
        now
      )
      .run();

    // Insert tags if any
    if (memory.tags && memory.tags.length > 0) {
      for (const tagName of memory.tags) {
        // Get or create tag
        let tag = await env.DB.prepare('SELECT id FROM tags WHERE name = ?')
          .bind(tagName)
          .first<{ id: number }>();
        if (!tag) {
          const result = await env.DB.prepare(
            'INSERT INTO tags (name) VALUES (?)'
          )
            .bind(tagName)
            .run();
          tag = { id: result.meta.last_row_id as number };
        }
        // Link tag to memory
        await env.DB.prepare(
          'INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)'
        )
          .bind(memory.id, tag.id)
          .run();
      }
    }

    // Delete from KV
    await env.TEMP_MEMORIES_KV.delete(`${TEMP_MEMORY_PREFIX}${id}`);

    return { ...memory, updated_at: now };
  }

  /**
   * List all temporary memories (for merging with D1 results)
   */
  static async listAll(env: Env): Promise<Memory[]> {
    const list = await env.TEMP_MEMORIES_KV.list({ prefix: TEMP_MEMORY_PREFIX });
    const memories: Memory[] = [];

    for (const key of list.keys) {
      const data = await env.TEMP_MEMORIES_KV.get(key.name);
      if (data) {
        const tempMemory: TemporaryMemory = JSON.parse(data);
        const { extension_count, ...memory } = tempMemory;
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Check if a memory exists as temporary
   */
  static async exists(env: Env, id: string): Promise<boolean> {
    const data = await env.TEMP_MEMORIES_KV.get(`${TEMP_MEMORY_PREFIX}${id}`);
    return data !== null;
  }

  /**
   * Delete a temporary memory
   */
  static async delete(env: Env, id: string): Promise<boolean> {
    const exists = await this.exists(env, id);
    if (!exists) return false;
    await env.TEMP_MEMORIES_KV.delete(`${TEMP_MEMORY_PREFIX}${id}`);
    return true;
  }

  /**
   * Update a temporary memory (preserves TTL based on extension count)
   */
  static async update(
    env: Env,
    id: string,
    updates: Partial<Memory>
  ): Promise<Memory | null> {
    const tempMemory = await this.get(env, id);
    if (!tempMemory) return null;

    const now = Math.floor(Date.now() / 1000);
    const updated: TemporaryMemory = {
      ...tempMemory,
      ...updates,
      id: tempMemory.id, // Preserve ID
      updated_at: now,
    };

    // Determine TTL based on extension count
    const ttl = tempMemory.extension_count === 0 ? TTL_14_DAYS : TTL_28_DAYS;

    await env.TEMP_MEMORIES_KV.put(
      `${TEMP_MEMORY_PREFIX}${id}`,
      JSON.stringify(updated),
      { expirationTtl: ttl }
    );

    const { extension_count, ...memory } = updated;
    return memory;
  }

  /**
   * Search temporary memories by query (basic text search)
   */
  static async search(
    env: Env,
    query: string,
    tags?: string[]
  ): Promise<Memory[]> {
    const allTemp = await this.listAll(env);
    const lowerQuery = query.toLowerCase();

    return allTemp.filter((memory) => {
      // Text search
      const matchesQuery =
        !query ||
        memory.name.toLowerCase().includes(lowerQuery) ||
        memory.content.toLowerCase().includes(lowerQuery);

      // Tag filter
      const matchesTags =
        !tags ||
        tags.length === 0 ||
        tags.every((tag) => memory.tags.includes(tag));

      return matchesQuery && matchesTags;
    });
  }
}
