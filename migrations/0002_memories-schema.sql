-- Migration number: 0002 	 2025-09-06T19:05:00.000Z

-- Memory table to store developer memories
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,  -- UUID
    name TEXT NOT NULL UNIQUE,  -- Identifiable name
    content TEXT NOT NULL,
    url TEXT,  -- Optional URL
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Tags table for categorization
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Junction table for memory-tag relationships
CREATE TABLE IF NOT EXISTS memory_tags (
    memory_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (memory_id, tag_id),
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_memories_name ON memories(name);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Full-text search virtual table for content search
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    name, 
    content, 
    content='memories', 
    content_rowid='rowid'
);

-- Triggers to keep FTS table in sync
CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, name, content) VALUES (new.rowid, new.name, new.content);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, name, content) VALUES('delete', old.rowid, old.name, old.content);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, name, content) VALUES('delete', old.rowid, old.name, old.content);
    INSERT INTO memories_fts(rowid, name, content) VALUES (new.rowid, new.name, new.content);
END;