-- Add columns for skill-bound API keys
-- key_type: 'standard' (default) or 'skill-bound'
-- parent_key_id: References the key used to generate this skill-bound key

ALTER TABLE api_keys ADD COLUMN key_type TEXT DEFAULT 'standard';
ALTER TABLE api_keys ADD COLUMN parent_key_id TEXT;

-- Indexes for querying skill-bound keys
CREATE INDEX IF NOT EXISTS idx_api_keys_type ON api_keys(key_type);
CREATE INDEX IF NOT EXISTS idx_api_keys_parent ON api_keys(parent_key_id);
