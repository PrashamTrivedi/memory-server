-- Migration number: 0001 	 2025-09-06T10:54:36.121Z

-- Add tag hierarchy table to support parent-child relationships
CREATE TABLE IF NOT EXISTS tag_hierarchy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_tag_id INTEGER NOT NULL,
    parent_tag_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(child_tag_id, parent_tag_id),
    FOREIGN KEY (child_tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    -- Prevent self-referencing (a tag cannot be its own parent)
    CHECK (child_tag_id != parent_tag_id)
);

-- Indexes for efficient hierarchy queries
CREATE INDEX IF NOT EXISTS idx_tag_hierarchy_child ON tag_hierarchy(child_tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_hierarchy_parent ON tag_hierarchy(parent_tag_id);

-- Trigger to prevent circular references
CREATE TRIGGER IF NOT EXISTS prevent_circular_hierarchy 
BEFORE INSERT ON tag_hierarchy
FOR EACH ROW
WHEN EXISTS (
    WITH RECURSIVE ancestors AS (
        SELECT parent_tag_id FROM tag_hierarchy WHERE child_tag_id = NEW.parent_tag_id
        UNION ALL
        SELECT th.parent_tag_id 
        FROM tag_hierarchy th
        JOIN ancestors a ON th.child_tag_id = a.parent_tag_id
    )
    SELECT 1 FROM ancestors WHERE parent_tag_id = NEW.child_tag_id
)
BEGIN
    SELECT RAISE(ABORT, 'Circular reference detected: Cannot create hierarchy that would result in a cycle');
END;
