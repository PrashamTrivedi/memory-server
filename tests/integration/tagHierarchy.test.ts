import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TagHierarchyService } from '../../src/services/tagHierarchy';

// Mock D1Database for testing
class MockD1Database {
  private data: Map<string, any[]> = new Map();
  private lastId = 0;

  prepare(sql: string) {
    return {
      bind: (...params: any[]) => ({
        first: async <T = any>(): Promise<T | null> => {
          if (sql.includes('SELECT id, name FROM tags WHERE name = ?')) {
            const name = params[0];
            const tags = this.data.get('tags') || [];
            const tag = tags.find(t => t.name === name);
            return tag || null;
          }
          
          if (sql.includes('SELECT id FROM tags WHERE id = ?')) {
            const id = params[0];
            const tags = this.data.get('tags') || [];
            const tag = tags.find(t => t.id === id);
            return tag ? { id: tag.id } : null;
          }

          if (sql.includes('SELECT id FROM tag_hierarchy WHERE child_tag_id = ? AND parent_tag_id = ?')) {
            const [childId, parentId] = params;
            const hierarchies = this.data.get('tag_hierarchy') || [];
            const relation = hierarchies.find(h => h.child_tag_id === childId && h.parent_tag_id === parentId);
            return relation || null;
          }

          if (sql.includes('INSERT INTO tags (name) VALUES (?) RETURNING id, name')) {
            const name = params[0];
            const tags = this.data.get('tags') || [];
            const newTag = { id: ++this.lastId, name };
            tags.push(newTag);
            this.data.set('tags', tags);
            return newTag;
          }

          if (sql.includes('INSERT INTO tag_hierarchy')) {
            const [childId, parentId] = params;
            const hierarchies = this.data.get('tag_hierarchy') || [];
            const newHierarchy = {
              id: ++this.lastId,
              child_tag_id: childId,
              parent_tag_id: parentId,
              created_at: Math.floor(Date.now() / 1000)
            };
            hierarchies.push(newHierarchy);
            this.data.set('tag_hierarchy', hierarchies);
            return newHierarchy;
          }

          return null;
        },
        all: async <T = any>(): Promise<{ results: T[] }> => {
          if (sql.includes('descendants')) {
            // Mock descendants query - return empty for simplicity
            return { results: [] };
          }
          return { results: [] };
        },
        run: async () => ({ success: true, meta: { last_row_id: this.lastId } })
      })
    };
  }

  reset() {
    this.data.clear();
    this.lastId = 0;
  }
}

describe('TagHierarchyService', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  afterEach(() => {
    mockDb.reset();
  });

  describe('getTagByName', () => {
    it('should return null for non-existent tag', async () => {
      const result = await TagHierarchyService.getTagByName(mockDb as any, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return tag when it exists', async () => {
      // Create a tag first
      await TagHierarchyService.createTag(mockDb as any, 'test-tag');
      
      const result = await TagHierarchyService.getTagByName(mockDb as any, 'test-tag');
      expect(result).toEqual({
        id: 1,
        name: 'test-tag'
      });
    });
  });

  describe('createTag', () => {
    it('should create a new tag', async () => {
      const result = await TagHierarchyService.createTag(mockDb as any, 'new-tag');
      
      expect(result).toEqual({
        id: 1,
        name: 'new-tag'
      });
    });
  });

  describe('createTagsWithRelationship', () => {
    it('should create both tags and establish hierarchy when neither exists', async () => {
      const result = await TagHierarchyService.createTagsWithRelationship(
        mockDb as any,
        'child-tag',
        'parent-tag'
      );

      expect(result.created_child).toBe(true);
      expect(result.created_parent).toBe(true);
      expect(result.child_tag.name).toBe('child-tag');
      expect(result.parent_tag.name).toBe('parent-tag');
      expect(result.hierarchy.child_tag_id).toBe(result.child_tag.id);
      expect(result.hierarchy.parent_tag_id).toBe(result.parent_tag.id);
    });

    it('should create child tag when only parent exists', async () => {
      // Create parent tag first
      await TagHierarchyService.createTag(mockDb as any, 'existing-parent');

      const result = await TagHierarchyService.createTagsWithRelationship(
        mockDb as any,
        'new-child',
        'existing-parent'
      );

      expect(result.created_child).toBe(true);
      expect(result.created_parent).toBe(false);
      expect(result.child_tag.name).toBe('new-child');
      expect(result.parent_tag.name).toBe('existing-parent');
    });

    it('should create parent tag when only child exists', async () => {
      // Create child tag first
      await TagHierarchyService.createTag(mockDb as any, 'existing-child');

      const result = await TagHierarchyService.createTagsWithRelationship(
        mockDb as any,
        'existing-child',
        'new-parent'
      );

      expect(result.created_child).toBe(false);
      expect(result.created_parent).toBe(true);
      expect(result.child_tag.name).toBe('existing-child');
      expect(result.parent_tag.name).toBe('new-parent');
    });

    it('should throw error when both tags exist with existing relationship', async () => {
      // Create both tags first
      await TagHierarchyService.createTag(mockDb as any, 'child');
      await TagHierarchyService.createTag(mockDb as any, 'parent');
      
      // Create relationship
      await TagHierarchyService.createTagsWithRelationship(mockDb as any, 'child', 'parent');

      // Try to create the same relationship again
      await expect(
        TagHierarchyService.createTagsWithRelationship(mockDb as any, 'child', 'parent')
      ).rejects.toThrow('Relationship between these tags already exists');
    });

    it('should throw error for self-reference', async () => {
      await expect(
        TagHierarchyService.createTagsWithRelationship(mockDb as any, 'self', 'self')
      ).rejects.toThrow('A tag cannot be its own parent');
    });

    it('should throw error for empty tag names', async () => {
      await expect(
        TagHierarchyService.createTagsWithRelationship(mockDb as any, '', 'parent')
      ).rejects.toThrow('Tag names cannot be empty');

      await expect(
        TagHierarchyService.createTagsWithRelationship(mockDb as any, 'child', '  ')
      ).rejects.toThrow('Tag names cannot be empty');
    });

    it('should trim whitespace from tag names', async () => {
      const result = await TagHierarchyService.createTagsWithRelationship(
        mockDb as any,
        '  child-tag  ',
        '  parent-tag  '
      );

      expect(result.child_tag.name).toBe('child-tag');
      expect(result.parent_tag.name).toBe('parent-tag');
    });
  });
});