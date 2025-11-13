import { Context, Next } from 'hono';
import { createHash } from 'node:crypto';

interface ApiKey {
  id: string;
  key_hash: string;
  entity_name: string;
  is_active: number;
  last_used_at: number | null;
  expires_at: number | null;
}

interface ApiKeyContext {
  id: string;
  entityName: string;
}

/**
 * Simple API key authentication middleware
 * All authenticated users get full access (no permissions)
 * Expects: Authorization: Bearer <api-key>
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: 'Missing or invalid Authorization header',
        hint: 'Use: Authorization: Bearer <your-api-key>'
      },
      401
    );
  }

  const apiKey = authHeader.substring(7);

  // Basic validation
  if (apiKey.length < 32) {
    return c.json(
      {
        success: false,
        error: 'Invalid API key format'
      },
      401
    );
  }

  // Hash the API key
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Query database
  const db = c.env.DB;
  const result = await db
    .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1')
    .bind(keyHash)
    .first() as ApiKey | null;

  if (!result) {
    return c.json(
      {
        success: false,
        error: 'Invalid or inactive API key'
      },
      401
    );
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (result.expires_at && result.expires_at < now) {
    return c.json(
      {
        success: false,
        error: 'API key has expired'
      },
      401
    );
  }

  // Update last_used_at (fire-and-forget)
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .bind(now, result.id)
    .run()
    .catch((err: unknown) => console.error('Failed to update last_used_at:', err));

  // Store auth context
  c.set('apiKey', {
    id: result.id,
    entityName: result.entity_name,
  } as ApiKeyContext);

  await next();
}

/**
 * Helper to get entity name from context
 */
export function getEntityName(c: Context): string {
  const apiKey = c.get('apiKey');
  return apiKey?.entityName || 'unknown';
}
