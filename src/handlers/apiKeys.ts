import { Context } from 'hono';
import { createHash, randomBytes } from 'node:crypto';
import { Env } from '../../types';

interface CreateKeyRequest {
  entity_name: string;
  notes?: string;
  expires_in_days?: number;
}

interface ApiKeyResponse {
  id: string;
  key: string;  // Only returned on creation!
  entity_name: string;
  created_at: number;
  expires_at: number | null;
  notes: string | null;
}

interface ApiKeyListItem {
  id: string;
  entity_name: string;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
  is_active: number;
  notes: string | null;
}

/**
 * Create a new API key
 * POST /api/admin/keys
 */
export async function createApiKey(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<CreateKeyRequest>();

    if (!body.entity_name || body.entity_name.trim() === '') {
      return c.json({
        success: false,
        error: 'entity_name is required'
      }, 400);
    }

    // Generate secure API key (32 bytes = 64 hex chars + msk_ prefix)
    const apiKey = 'msk_' + randomBytes(32).toString('hex');

    // Hash the key for storage
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // Generate UUID for id
    const id = randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    // Calculate expiration if specified
    let expiresAt: number | null = null;
    if (body.expires_in_days && body.expires_in_days > 0) {
      expiresAt = now + (body.expires_in_days * 24 * 60 * 60);
    }

    // Insert into database
    const db = c.env.DB;
    await db
      .prepare(`
        INSERT INTO api_keys (id, key_hash, entity_name, created_at, expires_at, notes, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `)
      .bind(id, keyHash, body.entity_name.trim(), now, expiresAt, body.notes || null)
      .run();

    const response: ApiKeyResponse = {
      id,
      key: apiKey,  // IMPORTANT: Only shown once!
      entity_name: body.entity_name.trim(),
      created_at: now,
      expires_at: expiresAt,
      notes: body.notes || null
    };

    return c.json({
      success: true,
      data: response,
      warning: 'Save this API key now. It will not be shown again!'
    }, 201);
  } catch (error) {
    console.error('Create API key error:', error);
    return c.json({
      success: false,
      error: 'Failed to create API key',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * List all API keys
 * GET /api/admin/keys
 */
export async function listApiKeys(c: Context<{ Bindings: Env }>) {
  try {
    const showInactive = c.req.query('show_inactive') === 'true';

    const db = c.env.DB;
    const query = showInactive
      ? 'SELECT id, entity_name, created_at, last_used_at, expires_at, is_active, notes FROM api_keys ORDER BY created_at DESC'
      : 'SELECT id, entity_name, created_at, last_used_at, expires_at, is_active, notes FROM api_keys WHERE is_active = 1 ORDER BY created_at DESC';

    const result = await db.prepare(query).all<ApiKeyListItem>();

    return c.json({
      success: true,
      data: {
        keys: result.results || [],
        total: result.results?.length || 0
      }
    });
  } catch (error) {
    console.error('List API keys error:', error);
    return c.json({
      success: false,
      error: 'Failed to list API keys',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * Get a specific API key details (without the actual key)
 * GET /api/admin/keys/:id
 */
export async function getApiKey(c: Context<{ Bindings: Env }>) {
  try {
    const id = c.req.param('id');

    const db = c.env.DB;
    const result = await db
      .prepare('SELECT id, entity_name, created_at, last_used_at, expires_at, is_active, notes FROM api_keys WHERE id = ?')
      .bind(id)
      .first<ApiKeyListItem>();

    if (!result) {
      return c.json({
        success: false,
        error: 'API key not found'
      }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get API key error:', error);
    return c.json({
      success: false,
      error: 'Failed to get API key',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * Revoke an API key (soft delete - sets is_active to 0)
 * DELETE /api/admin/keys/:id
 */
export async function revokeApiKey(c: Context<{ Bindings: Env }>) {
  try {
    const id = c.req.param('id');

    const db = c.env.DB;
    const result = await db
      .prepare('UPDATE api_keys SET is_active = 0 WHERE id = ? AND is_active = 1')
      .bind(id)
      .run();

    if (result.meta.changes === 0) {
      return c.json({
        success: false,
        error: 'API key not found or already revoked'
      }, 404);
    }

    return c.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return c.json({
      success: false,
      error: 'Failed to revoke API key',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * Bootstrap: Create first API key without authentication
 * POST /api/admin/keys/bootstrap
 * Only works when NO keys exist in the database
 */
export async function bootstrapApiKey(c: Context<{ Bindings: Env }>) {
  try {
    const db = c.env.DB;

    // Check if any keys already exist
    const existingKeys = await db
      .prepare('SELECT COUNT(*) as count FROM api_keys')
      .first<{ count: number }>();

    if (existingKeys && existingKeys.count > 0) {
      return c.json({
        success: false,
        error: 'Bootstrap not available. API keys already exist. Use the regular create endpoint with authentication.'
      }, 403);
    }

    // Parse request body
    const body = await c.req.json<CreateKeyRequest>();

    if (!body.entity_name || body.entity_name.trim() === '') {
      return c.json({
        success: false,
        error: 'entity_name is required'
      }, 400);
    }

    // Generate secure API key (32 bytes = 64 hex chars + msk_ prefix)
    const apiKey = 'msk_' + randomBytes(32).toString('hex');

    // Hash the key for storage
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // Generate UUID for id
    const id = randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    // Calculate expiration if specified
    let expiresAt: number | null = null;
    if (body.expires_in_days && body.expires_in_days > 0) {
      expiresAt = now + (body.expires_in_days * 24 * 60 * 60);
    }

    // Insert into database
    await db
      .prepare(`
        INSERT INTO api_keys (id, key_hash, entity_name, created_at, expires_at, notes, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `)
      .bind(id, keyHash, body.entity_name.trim(), now, expiresAt, body.notes || null)
      .run();

    const response: ApiKeyResponse = {
      id,
      key: apiKey,  // IMPORTANT: Only shown once!
      entity_name: body.entity_name.trim(),
      created_at: now,
      expires_at: expiresAt,
      notes: body.notes || null
    };

    return c.json({
      success: true,
      data: response,
      warning: 'Save this API key now. It will not be shown again! This is your bootstrap admin key.'
    }, 201);
  } catch (error) {
    console.error('Bootstrap API key error:', error);
    return c.json({
      success: false,
      error: 'Failed to create bootstrap API key',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * Update API key details (entity_name, notes)
 * PATCH /api/admin/keys/:id
 */
export async function updateApiKey(c: Context<{ Bindings: Env }>) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ entity_name?: string; notes?: string }>();

    if (!body.entity_name && body.notes === undefined) {
      return c.json({
        success: false,
        error: 'At least one field (entity_name or notes) must be provided'
      }, 400);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.entity_name && body.entity_name.trim() !== '') {
      updates.push('entity_name = ?');
      values.push(body.entity_name.trim());
    }

    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes);
    }

    values.push(id);

    const db = c.env.DB;
    const result = await db
      .prepare(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    if (result.meta.changes === 0) {
      return c.json({
        success: false,
        error: 'API key not found'
      }, 404);
    }

    return c.json({
      success: true,
      message: 'API key updated successfully'
    });
  } catch (error) {
    console.error('Update API key error:', error);
    return c.json({
      success: false,
      error: 'Failed to update API key',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
