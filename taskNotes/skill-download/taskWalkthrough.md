# Skill Download Feature - Walkthrough for Product Owners

## Feature Overview

This feature allows users to download a pre-configured Claude Code skill package that includes:
1. A SKILL.md file for Claude Code/Claude Desktop
2. An mcp.json file with pre-configured API key for MCP server connection

## How to Verify the Feature

### Prerequisites
- Memory server running (locally or deployed)
- Valid API key for authentication

### Step 1: Generate a Skill Package

**Request:**
```bash
curl -X POST https://your-server.workers.dev/api/skills/generate \
  -H "Authorization: Bearer msk_your_api_key" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "reused": false,
  "download_url": "/skills/download/abc123...",
  "expires_in": 14400,
  "skill_key": {
    "id": "unique-key-id",
    "entity_name": "skill-YourEntity-1234567890",
    "created_at": 1234567890
  },
  "instructions": {
    "mcp_config_redacted": {
      "mcpServers": {
        "memory-server": {
          "transport": "streamable-http",
          "url": "https://your-server.workers.dev/mcp",
          "headers": {
            "Authorization": "Bearer msk_****...****"
          }
        }
      }
    },
    "steps": [
      "Extract the downloaded ZIP file",
      "Copy memory-skill folder to ~/.config/claude/skills/",
      "Merge mcp.json into ~/.config/claude/claude_desktop_config.json",
      "Restart Claude Code or Claude Desktop",
      "Test with: 'Save a test note to memory'"
    ]
  }
}
```

### Step 2: Download the Skill Package

**Request:**
```bash
curl -O https://your-server.workers.dev/skills/download/abc123...
```

**Expected Result:**
- Downloads `memory-skill.zip` file
- No authentication required (token is the auth)

### Step 3: Verify ZIP Contents

```bash
unzip -l memory-skill.zip
```

**Expected Output:**
```
Archive:  memory-skill.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
     1607  2025-12-30 00:10   memory-skill/SKILL.md
      264  2025-12-30 00:10   memory-skill/mcp.json
---------                     -------
     1871                     2 files
```

### Step 4: Verify SKILL.md Content

```bash
unzip memory-skill.zip
cat memory-skill/SKILL.md
```

**Should contain:**
- YAML frontmatter with `name: memory-server`
- Server URL
- Usage instructions
- Tool reference table
- Tagging examples

### Step 5: Verify mcp.json Content

```bash
cat memory-skill/mcp.json
```

**Should contain:**
```json
{
  "mcpServers": {
    "memory-server": {
      "transport": "streamable-http",
      "url": "https://your-server.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer msk_actual_api_key_here"
      }
    }
  }
}
```

**Important:** The actual API key is in the downloaded file (not redacted).

### Step 6: Verify Reuse Logic

Call the generate endpoint again within 4 hours:

```bash
curl -X POST https://your-server.workers.dev/api/skills/generate \
  -H "Authorization: Bearer msk_your_api_key"
```

**Expected:**
- `"reused": true`
- Same `download_url`
- Same `skill_key.id`
- `expires_in` will be lower (remaining time)

### Step 7: Verify Skill-Bound Key in Database

Via API key list endpoint:
```bash
curl https://your-server.workers.dev/api/admin/keys \
  -H "Authorization: Bearer msk_your_api_key"
```

**Should show:**
- New key with `entity_name` starting with `skill-`
- Key linked to parent key

## Success Criteria

| Criterion | Expected |
|-----------|----------|
| Generate returns 201 | ✓ |
| Download returns ZIP | ✓ |
| ZIP has 2 files | ✓ |
| SKILL.md has server URL | ✓ |
| mcp.json has actual API key | ✓ |
| Instructions show redacted key | ✓ |
| Reuse works within 4h | ✓ |
| Token expires after 4h | ✓ |

## User Journey

1. User authenticates to memory server
2. User calls `/api/skills/generate`
3. User downloads ZIP from provided URL
4. User extracts ZIP to `~/.config/claude/skills/`
5. User merges mcp.json into Claude Desktop config
6. User restarts Claude Code
7. User can now use memory server via skill ("save this to memory")

## Notes

- API key in ZIP is a new skill-bound key (not the user's original key)
- Skill-bound keys can be independently revoked
- Package is cached for 4 hours to avoid regeneration
- Download endpoint requires no auth (token is single-use auth)
