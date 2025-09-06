export interface TagHierarchy {
  id: number;
  child_tag_id: number;
  parent_tag_id: number;
  created_at: number;
}

export interface TagHierarchyRow {
  id: number;
  child_tag_id: number;
  parent_tag_id: number;
  created_at: number;
}

export interface Tag {
  id: number;
  name: string;
}

export interface TagRow {
  id: number;
  name: string;
}

export interface TagTreeNode {
  id: number;
  name: string;
  children: TagTreeNode[];
  parents: TagTreeNode[];
}

export class TagHierarchyService {
  
  /**
   * Add a parent relationship to a tag
   * Validates that both tags exist and prevents circular references
   */
  static async addParent(
    db: D1Database, 
    childTagId: number, 
    parentTagId: number
  ): Promise<TagHierarchy> {
    // Validate that both tags exist
    const childTag = await db.prepare('SELECT id FROM tags WHERE id = ?')
      .bind(childTagId)
      .first();
    
    if (!childTag) {
      throw new Error(`Child tag with id ${childTagId} not found`);
    }

    const parentTag = await db.prepare('SELECT id FROM tags WHERE id = ?')
      .bind(parentTagId)
      .first();
    
    if (!parentTag) {
      throw new Error(`Parent tag with id ${parentTagId} not found`);
    }

    // Check if relationship already exists
    const existingRelation = await db.prepare(
      'SELECT id FROM tag_hierarchy WHERE child_tag_id = ? AND parent_tag_id = ?'
    ).bind(childTagId, parentTagId).first();

    if (existingRelation) {
      throw new Error('Parent relationship already exists');
    }

    // Validate hierarchy to prevent circular references
    await this.validateHierarchy(db, childTagId, parentTagId);

    // Insert the relationship - the trigger will prevent circular references
    const result = await db.prepare(`
      INSERT INTO tag_hierarchy (child_tag_id, parent_tag_id)
      VALUES (?, ?)
      RETURNING id, child_tag_id, parent_tag_id, created_at
    `).bind(childTagId, parentTagId).first<TagHierarchyRow>();

    if (!result) {
      throw new Error('Failed to create parent relationship');
    }

    return result;
  }

  /**
   * Remove a parent relationship from a tag
   */
  static async removeParent(
    db: D1Database, 
    childTagId: number, 
    parentTagId: number
  ): Promise<boolean> {
    const result = await db.prepare(`
      DELETE FROM tag_hierarchy 
      WHERE child_tag_id = ? AND parent_tag_id = ?
    `).bind(childTagId, parentTagId).run();

    return result.success && (result.meta?.changes || 0) > 0;
  }

  /**
   * Get all ancestor tags for a given tag using recursive query
   */
  static async getAncestors(db: D1Database, tagId: number): Promise<Tag[]> {
    const ancestors = await db.prepare(`
      WITH RECURSIVE ancestors AS (
        -- Base case: direct parents
        SELECT t.id, t.name, th.parent_tag_id, 1 as level
        FROM tags t
        JOIN tag_hierarchy th ON t.id = th.parent_tag_id
        WHERE th.child_tag_id = ?
        
        UNION ALL
        
        -- Recursive case: parents of parents
        SELECT t.id, t.name, th.parent_tag_id, a.level + 1
        FROM tags t
        JOIN tag_hierarchy th ON t.id = th.parent_tag_id
        JOIN ancestors a ON th.child_tag_id = a.id
      )
      SELECT DISTINCT id, name FROM ancestors
      ORDER BY level, name
    `).bind(tagId).all<TagRow>();

    return ancestors.results || [];
  }

  /**
   * Get all descendant tags for a given tag
   */
  static async getDescendants(db: D1Database, tagId: number): Promise<Tag[]> {
    const descendants = await db.prepare(`
      WITH RECURSIVE descendants AS (
        -- Base case: direct children
        SELECT t.id, t.name, th.child_tag_id, 1 as level
        FROM tags t
        JOIN tag_hierarchy th ON t.id = th.child_tag_id
        WHERE th.parent_tag_id = ?
        
        UNION ALL
        
        -- Recursive case: children of children
        SELECT t.id, t.name, th.child_tag_id, d.level + 1
        FROM tags t
        JOIN tag_hierarchy th ON t.id = th.child_tag_id
        JOIN descendants d ON th.parent_tag_id = d.id
      )
      SELECT DISTINCT id, name FROM descendants
      ORDER BY level, name
    `).bind(tagId).all<TagRow>();

    return descendants.results || [];
  }

  /**
   * Get the complete tag hierarchy structure as a tree
   */
  static async getTagTree(db: D1Database): Promise<TagTreeNode[]> {
    // Get all tags
    const allTags = await db.prepare('SELECT id, name FROM tags ORDER BY name')
      .all<TagRow>();

    if (!allTags.results || allTags.results.length === 0) {
      return [];
    }

    // Get all hierarchy relationships
    const relationships = await db.prepare(`
      SELECT child_tag_id, parent_tag_id 
      FROM tag_hierarchy
    `).all<{ child_tag_id: number; parent_tag_id: number }>();

    const relationshipMap = new Map<number, number[]>();
    const reverseRelationshipMap = new Map<number, number[]>();

    // Build relationship maps
    if (relationships.results) {
      for (const rel of relationships.results) {
        // Children map (parent_id -> child_ids[])
        if (!relationshipMap.has(rel.parent_tag_id)) {
          relationshipMap.set(rel.parent_tag_id, []);
        }
        relationshipMap.get(rel.parent_tag_id)!.push(rel.child_tag_id);

        // Parents map (child_id -> parent_ids[])
        if (!reverseRelationshipMap.has(rel.child_tag_id)) {
          reverseRelationshipMap.set(rel.child_tag_id, []);
        }
        reverseRelationshipMap.get(rel.child_tag_id)!.push(rel.parent_tag_id);
      }
    }

    // Convert to tree nodes with IDs only to avoid circular references
    const nodes: TagTreeNode[] = [];
    
    for (const tag of allTags.results) {
      const childIds = relationshipMap.get(tag.id) || [];
      const parentIds = reverseRelationshipMap.get(tag.id) || [];
      
      nodes.push({
        id: tag.id,
        name: tag.name,
        children: childIds.map(id => ({ 
          id, 
          name: allTags.results.find(t => t.id === id)?.name || '', 
          children: [], 
          parents: [] 
        })),
        parents: parentIds.map(id => ({ 
          id, 
          name: allTags.results.find(t => t.id === id)?.name || '', 
          children: [], 
          parents: [] 
        }))
      });
    }

    return nodes;
  }

  /**
   * Validate hierarchy to prevent circular references
   * This is an additional validation layer beyond the database trigger
   */
  static async validateHierarchy(
    db: D1Database, 
    childId: number, 
    parentId: number
  ): Promise<void> {
    // Check if adding this relationship would create a cycle
    // by checking if the parent is already a descendant of the child
    const descendants = await this.getDescendants(db, childId);
    
    const isCircular = descendants.some(descendant => descendant.id === parentId);
    
    if (isCircular) {
      throw new Error(
        `Circular reference detected: Tag ${parentId} is already a descendant of tag ${childId}`
      );
    }
  }

  /**
   * Get immediate parents of a tag
   */
  static async getImmediateParents(db: D1Database, tagId: number): Promise<Tag[]> {
    const parents = await db.prepare(`
      SELECT t.id, t.name
      FROM tags t
      JOIN tag_hierarchy th ON t.id = th.parent_tag_id
      WHERE th.child_tag_id = ?
      ORDER BY t.name
    `).bind(tagId).all<TagRow>();

    return parents.results || [];
  }

  /**
   * Get immediate children of a tag
   */
  static async getImmediateChildren(db: D1Database, tagId: number): Promise<Tag[]> {
    const children = await db.prepare(`
      SELECT t.id, t.name
      FROM tags t
      JOIN tag_hierarchy th ON t.id = th.child_tag_id
      WHERE th.parent_tag_id = ?
      ORDER BY t.name
    `).bind(tagId).all<TagRow>();

    return children.results || [];
  }

  /**
   * Check if a tag exists
   */
  static async tagExists(db: D1Database, tagId: number): Promise<boolean> {
    const result = await db.prepare('SELECT id FROM tags WHERE id = ?')
      .bind(tagId)
      .first();
    
    return !!result;
  }
}