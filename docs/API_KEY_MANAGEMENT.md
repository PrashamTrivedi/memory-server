# API Key Management Guide

## Overview

The Memory Server now includes a full API key management system that allows you to create, view, and revoke API keys directly from the UI.

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│         Web UI (Protected)              │
│  - Cloudflare Access (Email Auth)       │
│  - API Key Management Interface         │
└────────────────┬────────────────────────┘
                 │
                 │ Authenticated Request
                 ▼
┌─────────────────────────────────────────┐
│    API Key Management Endpoints         │
│    /api/admin/keys/*                    │
│    (Requires API Key Auth)              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│    D1 Database (api_keys table)         │
│    - SHA-256 hashed keys                │
│    - Metadata (entity, dates, notes)    │
└─────────────────────────────────────────┘
```

## Accessing the UI

### Step 1: Login to Memory Server UI
1. Navigate to: `https://memory-server-ui.dev-286.workers.dev`
2. Authenticate with Cloudflare Access (email OTP)
3. Once logged in, click **"API Keys"** in the navigation

### Step 2: Create Your First API Key
Since you need an API key to access the management endpoints, you'll need to create the first key manually:

```bash
# Generate a secure API key
node -e "console.log('msk_' + require('crypto').randomBytes(32).toString('hex'))"
# Output: msk_abc123def456... (save this!)

# Hash the key
node -e "const key='msk_abc123...'; console.log(require('crypto').createHash('sha256').update(key).digest('hex'))"
# Output: hash123...

# Insert into database
wrangler d1 execute memory-db --remote --command \
  "INSERT INTO api_keys (id, key_hash, entity_name, created_at, notes, is_active) \
   VALUES (lower(hex(randomblob(16))), 'hash123...', 'UI Admin Access', strftime('%s','now'), 'Initial admin key', 1)"
```

### Step 3: Use the UI to Manage Keys

Once you have your first admin key, configure your UI to use it for API calls, then you can manage all other keys through the UI.

## Using the UI

### Creating a New API Key

1. Click **"Create New Key"** button
2. Fill in the form:
   - **Entity Name**: Descriptive name (e.g., "Claude Desktop - Work Laptop")
   - **Notes**: Optional description
   - **Expires In**: Optional expiration in days
3. Click **"Create API Key"**
4. **⚠️ IMPORTANT**: Copy the key immediately! It will never be shown again.

### Key Display

The generated key looks like: `msk_1234567890abcdef...` (68 characters total)

**Security Note**: Only the SHA-256 hash is stored in the database. The actual key is shown only once during creation.

### Viewing Keys

The API Keys page shows all keys with:
- Entity Name
- Status (Active/Revoked)
- Created Date
- Last Used Date (updated for both direct API key and OAuth/MCP usage)
- Expiration Date
- Notes

### Revoking a Key

1. Find the key in the list
2. Click **"Revoke"** button
3. Confirm the action

**Note**: Revoked keys cannot be reactivated. You must create a new key.

## API Endpoints

### Create API Key
```http
POST /api/admin/keys
Authorization: Bearer msk_your_admin_key_here

{
  "entity_name": "Claude Desktop - Laptop",
  "notes": "For MCP integration",
  "expires_in_days": 90
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc-123",
    "key": "msk_1234567890abcdef...",
    "entity_name": "Claude Desktop - Laptop",
    "created_at": 1731536400,
    "expires_at": 1739312400,
    "notes": "For MCP integration"
  },
  "warning": "Save this API key now. It will not be shown again!"
}
```

### List All Keys
```http
GET /api/admin/keys?show_inactive=false
Authorization: Bearer msk_your_admin_key_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "abc-123",
        "entity_name": "Claude Desktop - Laptop",
        "created_at": 1731536400,
        "last_used_at": 1731540000,
        "expires_at": 1739312400,
        "is_active": 1,
        "notes": "For MCP integration"
      }
    ],
    "total": 1
  }
}
```

### Get Single Key
```http
GET /api/admin/keys/{id}
Authorization: Bearer msk_your_admin_key_here
```

### Update Key
```http
PATCH /api/admin/keys/{id}
Authorization: Bearer msk_your_admin_key_here

{
  "entity_name": "Updated Name",
  "notes": "Updated notes"
}
```

### Revoke Key
```http
DELETE /api/admin/keys/{id}
Authorization: Bearer msk_your_admin_key_here
```

## Security Best Practices

### Key Generation
- Keys are 32 bytes (256 bits) of cryptographically secure random data
- Format: `msk_` prefix + 64 hex characters = 68 chars total
- Only SHA-256 hash stored in database

### Key Storage
- **Never commit keys to git**
- Store in environment variables
- Use secure secrets managers (1Password, Vault, etc.)
- Share keys through encrypted channels only

### Key Rotation
Recommended rotation schedule:
- **Production keys**: Every 90 days
- **Development keys**: Every 30 days or on team member changes
- **Compromised keys**: Immediately

### Key Expiration
- Set expiration dates for temporary access
- Use `expires_in_days` parameter when creating keys
- Expired keys automatically become inactive

### Access Control
Current model: **All authenticated users have full access**

For production, consider:
- Creating separate "admin" API keys for key management
- Implementing role-based access control (RBAC)
- Adding admin-only middleware to `/api/admin/*` endpoints

## Use Cases

### For MCP Clients
```bash
# Create key for Claude Desktop
POST /api/admin/keys
{
  "entity_name": "Claude Desktop - Personal",
  "notes": "Primary MCP client",
  "expires_in_days": 90
}

# Configure in claude_desktop_config.json
{
  "mcpServers": {
    "memory-server": {
      "command": "node",
      "args": ["/path/to/proxy.js"],
      "env": {
        "API_KEY": "msk_generated_key_here"
      }
    }
  }
}
```

### For Mobile App
```bash
# Create key with shorter expiration
POST /api/admin/keys
{
  "entity_name": "Mobile App - iOS",
  "expires_in_days": 30
}
```

### For CI/CD Pipeline
```bash
# Read-only key for automated tests
POST /api/admin/keys
{
  "entity_name": "GitHub Actions CI",
  "notes": "Read-only access for tests",
  "expires_in_days": 365
}
```

## Monitoring

### Check Key Usage
```bash
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name,
          datetime(created_at, 'unixepoch') as created,
          datetime(last_used_at, 'unixepoch') as last_used,
          is_active
   FROM api_keys
   ORDER BY last_used_at DESC"
```

### Find Unused Keys
```bash
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name,
          datetime(created_at, 'unixepoch') as created,
          datetime(last_used_at, 'unixepoch') as last_used
   FROM api_keys
   WHERE (last_used_at IS NULL OR last_used_at < strftime('%s', 'now', '-30 days'))
   AND is_active = 1"
```

### Check Expired Keys
```bash
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name,
          datetime(expires_at, 'unixepoch') as expires
   FROM api_keys
   WHERE expires_at < strftime('%s', 'now')
   AND is_active = 1"
```

## Troubleshooting

### "Invalid or inactive API key"
- Check if key is active in the UI
- Verify key hasn't expired
- Ensure key is copied correctly (68 characters)

### "Missing or invalid Authorization header"
- Use format: `Authorization: Bearer msk_...`
- Don't include quotes around the key
- Check for extra spaces or newlines

### UI shows "Failed to load API keys"
- Verify you're authenticated via Cloudflare Access
- Check your admin API key is valid
- Ensure API key has proper permissions

### Can't create keys from UI
- First admin key must be created via CLI
- Once you have one admin key, use it to manage others

## Migration from CLI-Only

If you were using CLI-generated keys before:

1. **Don't delete old keys** - They will continue to work
2. **Create admin key** - Generate one admin key for UI access
3. **Gradually migrate** - Create new keys through UI
4. **Revoke old keys** - Once clients are updated, revoke old keys

## OAuth Token Management

### Token Flow and Lifetimes

When using MCP clients with OAuth authentication, the server implements a secure token flow with automatic refresh capabilities:

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

| Token Type | Lifetime | Storage | Notes |
|------------|----------|---------|-------|
| Access Token | 24 hours | JWT (stateless) | Used for API authentication |
| Refresh Token | 30 days | KV (stateful) | Single-use with automatic rotation |

### Refresh Token Usage

The OAuth token endpoint supports the `refresh_token` grant type for obtaining new access tokens without re-authentication:

```bash
# Request new access token using refresh token
curl -X POST https://memory-server.dev/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "your_refresh_token_here"
  }'
```

**Response:**
```json
{
  "access_token": "new_jwt_token...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "new_refresh_token...",
  "scope": "mcp:full"
}
```

**Security Features:**
- Refresh tokens are single-use only (automatic rotation)
- Old refresh tokens are immediately invalidated after use
- Each refresh returns both a new access token AND a new refresh token
- Attempting to reuse an old refresh token will fail with `invalid_grant` error

### Last Used Tracking

API keys now properly track usage across all authentication methods:
- Direct API key authentication (Bearer msk_...)
- OAuth/JWT token authentication (Bearer jwt_...)
- MCP client requests using OAuth tokens

The `last_used_at` field is automatically updated whenever the key is used, regardless of authentication method. This allows you to monitor key activity and identify unused keys.

## Email Notifications

### Key Creation Notifications

When the server is configured with email notification settings, a notification email is automatically sent to the server owner whenever a new API key is created. This provides a backup record of API keys for recovery purposes.

**Required Environment Variables:**
- `EMAIL_API_KEY`: API key for the email service (prashamhtrivedi.in email sender)
- `NOTIFICATION_EMAIL`: Email address to receive key creation notifications

**Email Contents:**
The notification email includes:
- Entity name of the created key
- The full API key (for recovery)
- Timestamp of creation
- Security warning to save the key securely

**Example Configuration:**
```bash
# In wrangler.toml or environment settings
EMAIL_API_KEY = "your_email_api_key_here"
NOTIFICATION_EMAIL = "admin@yourdomain.com"
```

**Note:** This is a fire-and-forget operation. If email sending fails, the key creation will still succeed, and the failure will be logged.

## Future Enhancements

Potential improvements:
- Role-based access control (RBAC)
- API key permissions (read/write/delete)
- Key usage analytics dashboard
- Automatic key rotation
- Multi-factor authentication for key creation
- Webhook notifications for key events
- Integration with external identity providers

## Support

For issues or questions:
- Check logs: `wrangler tail`
- Review database: `wrangler d1 execute memory-db --remote --command "SELECT * FROM api_keys"`
- GitHub Issues: [Report an issue](https://github.com/PrashamTrivedi/memory-server/issues)
