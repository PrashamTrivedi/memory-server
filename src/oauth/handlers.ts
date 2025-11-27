import { Context } from 'hono';
import { SignJWT } from 'jose';
import { apiKeyEntryForm, errorPage } from './templates';
import { Env } from '../../types';

interface AuthCodeData {
  code_challenge: string;
  api_key_id: string;
  client_id: string;
  redirect_uri: string;
}

interface ApiKeyRecord {
  id: string;
  key_hash: string;
  entity_name: string;
  is_active: number;
  expires_at: number | null;
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Base64Url(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  let binary = '';
  for (let i = 0; i < hashArray.length; i++) {
    binary += String.fromCharCode(hashArray[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function showAuthorizeForm(c: Context<{ Bindings: Env }>) {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method } = c.req.query();

  if (!redirect_uri || !code_challenge || code_challenge_method !== 'S256') {
    return c.html(errorPage('Invalid OAuth request. Missing required parameters or unsupported code_challenge_method (only S256 supported).'), 400);
  }

  return c.html(apiKeyEntryForm({ client_id, redirect_uri, state, code_challenge }));
}

export async function handleAuthorize(c: Context<{ Bindings: Env }>) {
  const body = await c.req.parseBody();
  const api_key = body['api_key'] as string;
  const client_id = body['client_id'] as string;
  const redirect_uri = body['redirect_uri'] as string;
  const state = body['state'] as string;
  const code_challenge = body['code_challenge'] as string;

  if (!api_key || !redirect_uri || !code_challenge) {
    return c.html(errorPage('Missing required fields.'), 400);
  }

  const keyHash = await sha256(api_key);
  const apiKeyRecord = await c.env.DB
    .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1')
    .bind(keyHash)
    .first() as ApiKeyRecord | null;

  if (!apiKeyRecord) {
    return c.html(apiKeyEntryForm({
      client_id, redirect_uri, state, code_challenge,
      error: 'Invalid API key. Please check and try again.'
    }));
  }

  const now = Math.floor(Date.now() / 1000);
  if (apiKeyRecord.expires_at && apiKeyRecord.expires_at < now) {
    return c.html(apiKeyEntryForm({
      client_id, redirect_uri, state, code_challenge,
      error: 'API key has expired.'
    }));
  }

  const authCode = generateRandomHex(32);

  const authCodeData: AuthCodeData = {
    code_challenge,
    api_key_id: apiKeyRecord.id,
    client_id: client_id || 'default',
    redirect_uri,
  };

  await c.env.CACHE_KV.put(
    `oauth_code:${authCode}`,
    JSON.stringify(authCodeData),
    { expirationTtl: 300 }
  );

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) redirectUrl.searchParams.set('state', state);

  return c.redirect(redirectUrl.toString());
}

export async function handleToken(c: Context<{ Bindings: Env }>) {
  const body = await c.req.parseBody();
  const code = body['code'] as string;
  const code_verifier = body['code_verifier'] as string;
  const grant_type = body['grant_type'] as string;

  if (grant_type !== 'authorization_code') {
    return c.json({ error: 'unsupported_grant_type' }, 400);
  }

  if (!code || !code_verifier) {
    return c.json({ error: 'invalid_request', error_description: 'Missing code or code_verifier' }, 400);
  }

  const authCodeDataStr = await c.env.CACHE_KV.get(`oauth_code:${code}`);

  if (!authCodeDataStr) {
    return c.json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }, 400);
  }

  const authCodeData: AuthCodeData = JSON.parse(authCodeDataStr);

  const computedChallenge = await sha256Base64Url(code_verifier);

  if (computedChallenge !== authCodeData.code_challenge) {
    return c.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
  }

  await c.env.CACHE_KV.delete(`oauth_code:${code}`);

  const apiKey = await c.env.DB
    .prepare('SELECT * FROM api_keys WHERE id = ?')
    .bind(authCodeData.api_key_id)
    .first() as ApiKeyRecord | null;

  if (!apiKey) {
    return c.json({ error: 'invalid_grant', error_description: 'API key no longer exists' }, 400);
  }

  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const baseUrl = new URL(c.req.url).origin;

  const accessToken = await new SignJWT({
    sub: apiKey.id,
    entity: apiKey.entity_name,
    scope: 'mcp:full'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(baseUrl)
    .setAudience(baseUrl)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'mcp:full'
  });
}
