import type { Env, Memory, TemporaryMemory, TemporaryMemoryWithMetadata } from '../../types';

const TTL_14_DAYS = 14 * 24 * 60 * 60; // 1,209,600 seconds (Stage 1)
const TTL_28_DAYS = 28 * 24 * 60 * 60; // 2,419,200 seconds (Stage 2)
const TEMP_MEMORY_PREFIX = 'temp_memory:';

// Lifecycle thresholds
const STAGE_1_THRESHOLD = 5;  // Accesses needed to advance to Stage 2
const STAGE_2_THRESHOLD = 15; // Total accesses needed for auto-promotion

export class TemporaryMemoryService {
  /**
   * Create a new temporary memory in KV
   */
  static async create(env: Env, memory: Memory): Promise<TemporaryMemory> {
    const now = Math.floor(Date.now() / 1000);
    const tempMemory: TemporaryMemory = {
      ...memory,
      access_count: 0,
      stage: 1,
      last_accessed: now,
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
   * Handle memory access - increment access count, advance stage, or promote to permanent
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

    const now = Math.floor(Date.now() / 1000);
    const newAccessCount = tempMemory.access_count + 1;

    // Check for auto-promotion (stage 2 with 15+ accesses)
    if (tempMemory.stage === 2 && newAccessCount >= STAGE_2_THRESHOLD) {
      const promoted = await this.promote(env, id);
      return { promoted: true, memory: promoted };
    }

    // Check for stage advancement (stage 1 with 5+ accesses)
    let newStage: 1 | 2 = tempMemory.stage;
    let newTtl = tempMemory.stage === 1 ? TTL_14_DAYS : TTL_28_DAYS;

    if (tempMemory.stage === 1 && newAccessCount >= STAGE_1_THRESHOLD) {
      newStage = 2;
      newTtl = TTL_28_DAYS;
    }

    // Update with new access info
    const updated: TemporaryMemory = {
      ...tempMemory,
      access_count: newAccessCount,
      stage: newStage,
      last_accessed: now,
      updated_at: now,
    };

    await env.TEMP_MEMORIES_KV.put(
      `${TEMP_MEMORY_PREFIX}${id}`,
      JSON.stringify(updated),
      { expirationTtl: newTtl }
    );

    // Return memory without lifecycle metadata
    const { access_count, stage, last_accessed, ...memory } = updated;
    return { promoted: false, memory };
  }

  /**
   * Promote a temporary memory to permanent (insert to D1, delete from KV)
   */
  static async promote(env: Env, id: string): Promise<Memory | null> {
    const tempMemory = await this.get(env, id);
    if (!tempMemory) return null;

    const { access_count, stage, last_accessed, ...memory } = tempMemory;
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
   * Returns memories WITHOUT lifecycle metadata
   */
  static async listAll(env: Env): Promise<Memory[]> {
    const list = await env.TEMP_MEMORIES_KV.list({ prefix: TEMP_MEMORY_PREFIX });
    const memories: Memory[] = [];

    for (const key of list.keys) {
      const data = await env.TEMP_MEMORIES_KV.get(key.name);
      if (data) {
        const tempMemory: TemporaryMemory = JSON.parse(data);
        const { access_count, stage, last_accessed, ...memory } = tempMemory;
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * List all temporary memories WITH lifecycle metadata (for review endpoint)
   * Sorted by days_until_expiry ascending (most urgent first)
   */
  static async listAllWithMetadata(env: Env): Promise<TemporaryMemoryWithMetadata[]> {
    const list = await env.TEMP_MEMORIES_KV.list({ prefix: TEMP_MEMORY_PREFIX });
    const memories: TemporaryMemoryWithMetadata[] = [];

    for (const key of list.keys) {
      const data = await env.TEMP_MEMORIES_KV.get(key.name);
      if (data) {
        const tempMemory: TemporaryMemory = JSON.parse(data);

        // Calculate days until expiry based on stage TTL and last_accessed
        const ttlSeconds = tempMemory.stage === 1 ? TTL_14_DAYS : TTL_28_DAYS;
        const expiresAt = tempMemory.last_accessed + ttlSeconds;
        const now = Math.floor(Date.now() / 1000);
        const secondsUntilExpiry = Math.max(0, expiresAt - now);
        const daysUntilExpiry = Math.ceil(secondsUntilExpiry / (24 * 60 * 60));

        memories.push({
          id: tempMemory.id,
          name: tempMemory.name,
          content: tempMemory.content,
          url: tempMemory.url,
          tags: tempMemory.tags,
          created_at: tempMemory.created_at,
          updated_at: tempMemory.updated_at,
          access_count: tempMemory.access_count,
          stage: tempMemory.stage,
          last_accessed: tempMemory.last_accessed,
          days_until_expiry: daysUntilExpiry,
        });
      }
    }

    // Sort by days_until_expiry ascending (most urgent first)
    return memories.sort((a, b) => a.days_until_expiry - b.days_until_expiry);
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
   * Update a temporary memory (preserves TTL based on stage)
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

    // Determine TTL based on stage
    const ttl = tempMemory.stage === 1 ? TTL_14_DAYS : TTL_28_DAYS;

    await env.TEMP_MEMORIES_KV.put(
      `${TEMP_MEMORY_PREFIX}${id}`,
      JSON.stringify(updated),
      { expirationTtl: ttl }
    );

    const { access_count, stage, last_accessed, ...memory } = updated;
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
