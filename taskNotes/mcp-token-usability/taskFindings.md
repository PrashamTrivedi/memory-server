# Purpose

Improve MCP token/API key usability by extending token lifetime, adding key recovery via email, and fixing the "last used" tracking bug.

## Original Ask

> There is a usability issue around whole MCP configuration and token experience...First. the MCP token is short running, I need to configure it to every day which is not something I expect.
>
> Second, now I forgot that key. And since this is my own project, there needs to be a way to have the key, probably in the mail
>
> Third. I created a key last night. Ran a query and created a couple of memory all using MCP... It doesn't show anything in last used.....

## Complexity and the reason behind it

**Complexity Score: 3/5**

Reasoning:
- Three distinct issues requiring changes across multiple files
- Issue 3 (last_used bug) is a straightforward code fix
- Issue 1 (token lifetime) requires implementing refresh token grant type
- Issue 2 (email recovery) uses hardcoded env email (simplified - no DB changes)
- Overall verification requires end-to-end OAuth flow testing with MCP clients

**Note:** MCP OAuth supports refresh tokens per spec, but there's a known limitation ([Issue #1735](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1735)) where MCP clients may not forward refresh tokens to servers. We implement it anyway for future compatibility.

## Root Cause Analysis

### Issue 1: Short-lived OAuth tokens (1 hour)

**Location:** [oauth/handlers.ts:207](src/oauth/handlers.ts#L207)

```typescript
const accessToken = await new SignJWT({...})
  .setExpirationTime('1h')  // <-- Only 1 hour!
  .sign(secret);
```

The JWT access token expires in just 1 hour, forcing users to re-authenticate multiple times per day.

### Issue 2: No key recovery mechanism

**Location:** [handlers/apiKeys.ts:71-84](src/handlers/apiKeys.ts#L71-L84)

```typescript
const response: ApiKeyResponse = {
  id,
  key: apiKey,  // IMPORTANT: Only shown once!
  ...
};
return c.json({
  success: true,
  data: response,
  warning: 'Save this API key now. It will not be shown again!'
});
```

API keys are only shown once at creation with no recovery mechanism.

### Issue 3: "Last used" not updating for MCP/OAuth requests (BUG)

**Location:** [middleware/dualAuth.ts:35-59](src/middleware/dualAuth.ts#L35-L59)

```typescript
// When JWT auth is used, last_used_at is NEVER updated!
try {
  const { payload } = await jwtVerify(token, secret, {...});

  // Sets context but doesn't update last_used_at in DB
  c.set('auth', { type: 'oauth', apiKeyId, entityName });
  c.set('apiKey', { id: apiKeyId, entityName });

  await next();  // Missing: UPDATE api_keys SET last_used_at = ? WHERE id = ?
}
```

Compare with [middleware/apiKeyAuth.ts:82-86](src/middleware/apiKeyAuth.ts#L82-L86) which correctly updates:

```typescript
// Update last_used_at (fire-and-forget)
db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
  .bind(now, result.id)
  .run()
  .catch((err: unknown) => console.error('Failed to update last_used_at:', err));
```

## Architectural changes required

### Email Service Integration (for key notification)

**Approach: Custom Email API (prashamhtrivedi.in)**
- Endpoint: `https://email-sender.prashamhtrivedi.in/api/send`
- Add `EMAIL_API_KEY` to environment variables
- Add `NOTIFICATION_EMAIL` env var for hardcoded recipient
- From: `memories@prashamhtrivedi.in`
- No database schema changes needed

### Token Architecture (OAuth 2.1 with Refresh Tokens)

```
┌─────────────────────────────────────────────────────────────┐
│                    Token Flow                                │
├─────────────────────────────────────────────────────────────┤
│  1. User enters API key → Authorization code issued          │
│  2. Code exchanged → Access token (24h) + Refresh token (30d)│
│  3. Access token expires → Client uses refresh token         │
│  4. Refresh token used → New access + NEW refresh (rotation) │
└─────────────────────────────────────────────────────────────┘
```

**Token Lifetimes:**
| Token Type | Lifetime | Storage |
|------------|----------|---------|
| Access Token | 24 hours | JWT (stateless) |
| Refresh Token | 30 days | KV (stateful, for rotation) |

**Security Requirements (per MCP OAuth 2.1):**
- Refresh tokens MUST be rotated on each use (single-use)
- Old refresh tokens MUST be invalidated
- Reuse detection: if old token used, invalidate entire chain

## Backend changes required

### 1. Fix "last_used_at" bug in dualAuth.ts

Add `last_used_at` update after successful JWT verification:

```typescript
// After line 57 in dualAuth.ts
const now = Math.floor(Date.now() / 1000);
c.env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
  .bind(now, apiKeyId)
  .run()
  .catch((err: unknown) => console.error('Failed to update last_used_at:', err));
```

### 2. Implement Refresh Token Flow

**Modify [oauth/handlers.ts](src/oauth/handlers.ts):**

```typescript
// In handleToken(), after successful auth code exchange:
const accessToken = await new SignJWT({...})
  .setExpirationTime('24h')  // Changed from 1h
  .sign(secret);

// Generate refresh token
const refreshToken = generateRandomHex(64);
const refreshTokenData = {
  api_key_id: apiKey.id,
  entity_name: apiKey.entity_name,
  created_at: Date.now(),
  family_id: generateRandomHex(16), // For rotation tracking
};

// Store in KV with 30-day expiry
await c.env.CACHE_KV.put(
  `refresh_token:${refreshToken}`,
  JSON.stringify(refreshTokenData),
  { expirationTtl: 30 * 24 * 60 * 60 }
);

return c.json({
  access_token: accessToken,
  refresh_token: refreshToken,  // NEW
  token_type: 'Bearer',
  expires_in: 86400,  // 24 hours
});
```

**Add new handler `handleRefreshToken()`:**

```typescript
export async function handleRefreshToken(c: Context<{ Bindings: Env }>) {
  const { refresh_token } = await c.req.json();

  // 1. Validate refresh token exists in KV
  // 2. Check if already used (rotation detection)
  // 3. Invalidate old token
  // 4. Issue new access token + NEW refresh token
  // 5. Store new refresh token with same family_id
}
```

**Update token endpoint to handle `grant_type: refresh_token`**

### 3. Add email notification on key creation

**Modify [handlers/apiKeys.ts](src/handlers/apiKeys.ts):**

```typescript
// After successful key creation, send email to NOTIFICATION_EMAIL env var
if (c.env.NOTIFICATION_EMAIL && c.env.EMAIL_API_KEY) {
  await sendKeyCreatedEmail(c.env, {
    to: c.env.NOTIFICATION_EMAIL,
    entityName: body.entity_name,
    apiKey: apiKey,
  });
}
```

**Add email utility:**

```typescript
// src/utils/email.ts
const EMAIL_API_ENDPOINT = 'https://email-sender.prashamhtrivedi.in/api/send';

interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
}

export async function sendKeyCreatedEmail(env: Env, data: {
  to: string;
  entityName: string;
  apiKey: string;
}) {
  const payload: EmailPayload = {
    from: 'Memory Server <memories@prashamhtrivedi.in>',
    to: [data.to],
    subject: `New API Key Created: ${data.entityName}`,
    htmlBody: `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">New API Key Created</h2>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; font-weight: 600; color: #374151; width: 140px;">Entity:</td>
                <td style="padding: 12px 0; color: #6b7280;">${data.entityName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: 600; color: #374151;">API Key:</td>
                <td style="padding: 12px 0; color: #6b7280; font-family: monospace; word-break: break-all;">${data.apiKey}</td>
              </tr>
            </table>
            <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Important:</strong> Save this API key securely. It will not be shown again.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    textBody: `New API Key Created\n\nEntity: ${data.entityName}\nAPI Key: ${data.apiKey}\n\nSave this key securely. It will not be shown again.`,
  };

  const response = await fetch(EMAIL_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.EMAIL_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Email API error: ${response.status} - ${errorText}`);
  }
}
```

### 4. Update OAuth metadata

**Modify [oauth/metadata.ts](src/oauth/metadata.ts):**

Add `refresh_token` to supported grant types:

```typescript
grant_types_supported: ['authorization_code', 'refresh_token'],
```

## Frontend changes required

None required for MVP. The changes are purely backend/API focused.

Future enhancement: Add email field in UI key creation form.

## Acceptance Criteria

1. **Token Lifetime & Refresh**
   - Access tokens valid for 24 hours
   - Refresh tokens valid for 30 days
   - Refresh token rotation works correctly
   - Token endpoint supports `grant_type: refresh_token`

2. **Key Email Notification**
   - Email sent to `NOTIFICATION_EMAIL` on key creation
   - Email contains the API key and entity name

3. **Last Used Tracking**
   - MCP requests via OAuth update `last_used_at`
   - Visible in key listing and detail views

## Validation

### Issue 3 Fix (Last Used)

```bash
# 1. Create an API key and note its ID
curl -X POST https://memory-server.dev/api/admin/keys \
  -H "Authorization: Bearer msk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"entity_name": "Test Key"}'

# 2. Use OAuth flow to get JWT token for this key

# 3. Make MCP request with JWT token
curl -X POST https://memory-server.dev/mcp \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'

# 4. Check last_used_at was updated
curl https://memory-server.dev/api/admin/keys/<key_id> \
  -H "Authorization: Bearer msk_xxx"
# Verify last_used_at is non-null and recent
```

### Issue 1 Fix (Token Lifetime + Refresh)

```bash
# 1. Get OAuth tokens (authorization_code grant)
# Response should include both access_token and refresh_token

# 2. Decode JWT and verify exp claim is 24 hours from now:
echo "<jwt_token>" | cut -d. -f2 | base64 -d | jq '.exp'

# 3. Test refresh token flow
curl -X POST https://memory-server.dev/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "<refresh_token>"
  }'
# Should return new access_token + new refresh_token (rotated)

# 4. Verify old refresh token is invalidated (should fail)
curl -X POST https://memory-server.dev/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "<old_refresh_token>"
  }'
# Should return error
```

### Issue 2 Fix (Email Notification)

```bash
# Set env vars:
# NOTIFICATION_EMAIL=your@email.com
# EMAIL_API_KEY=your_email_api_key

# Create key
curl -X POST https://memory-server.dev/api/admin/keys \
  -H "Authorization: Bearer msk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"entity_name": "My New Key"}'

# Check inbox (NOTIFICATION_EMAIL) for email with API key
# Email will be from: memories@prashamhtrivedi.in
```
