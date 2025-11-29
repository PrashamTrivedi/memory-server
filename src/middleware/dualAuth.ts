import { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import { apiKeyAuth } from './apiKeyAuth';
import { Env } from '../../types';

interface ApiKeyContext {
  id: string;
  entityName: string;
}

interface AuthContext {
  type: 'oauth';
  apiKeyId: string;
  entityName: string;
}

type Variables = {
  apiKey: ApiKeyContext;
  auth: AuthContext;
};

export async function dualAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorizedResponse(c);
  }

  const token = authHeader.substring(7);

  if (token.startsWith('msk_')) {
    return apiKeyAuth(c, next);
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const baseUrl = new URL(c.req.url).origin;
    const resourceUrl = `${baseUrl}/mcp`; // RFC 8707 resource URL

    const { payload } = await jwtVerify(token, secret, {
      issuer: baseUrl,
      audience: [baseUrl, resourceUrl], // Accept both base URL and resource URL
    });

    const apiKeyId = payload.sub || '';
    const entityName = (payload.entity as string) || '';

    c.set('auth', {
      type: 'oauth',
      apiKeyId,
      entityName,
    });

    c.set('apiKey', {
      id: apiKeyId,
      entityName,
    });

    // Update last_used_at for OAuth/JWT authentication (fire-and-forget)
    const now = Math.floor(Date.now() / 1000);
    c.env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
      .bind(now, apiKeyId)
      .run()
      .catch((err: unknown) => console.error('Failed to update last_used_at:', err));

    await next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return unauthorizedResponse(c);
  }
}

function unauthorizedResponse(c: Context<{ Bindings: Env; Variables: Variables }>) {
  const baseUrl = new URL(c.req.url).origin;

  return c.json(
    {
      success: false,
      error: 'Unauthorized',
      hint: 'Provide API key (Bearer msk_...) or OAuth token'
    },
    401,
    {
      'WWW-Authenticate': `Bearer resource="${baseUrl}/.well-known/oauth-protected-resource"`
    }
  );
}
