-- Create API keys table for simple authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,                 -- UUID
  key_hash TEXT UNIQUE NOT NULL,       -- SHA-256 hash of API key
  entity_name TEXT NOT NULL,           -- Human-readable: "Claude Desktop - Laptop"
  created_at INTEGER NOT NULL,         -- Unix timestamp
  last_used_at INTEGER,                -- Unix timestamp, updated on use
  expires_at INTEGER,                  -- Unix timestamp, NULL = never expires
  is_active INTEGER DEFAULT 1,         -- 0 = revoked, 1 = active
  notes TEXT                           -- Optional notes
);

-- Indexes for performance
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_entity ON api_keys(entity_name);
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at);

-- Example: Insert a test key (key: test_msk_abc123def456)
-- Hash generated with: echo -n "test_msk_abc123def456" | sha256sum
INSERT INTO api_keys (id, key_hash, entity_name, created_at, notes)
VALUES
  (
    lower(hex(randomblob(16))),
    '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    'Test Key',
    strftime('%s','now'),
    'Development test key - revoke in production'
  );
