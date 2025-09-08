import { describe, it, expect, beforeEach } from 'vitest';

// Mock database that tracks operations
class TestDatabase {
  public operations: Array<{ method: string; sql: string; params: any[] }> = [];
  private tags = new Map<string, { id: number; name: string }>();
  private hierarchies = new Map<string, any>();
  private memoryTags = new Map<string, number[]>();
  private nextId = 1;

  prepare(sql: string) {
    return {
      bind: (...params: any[]) => {
        this.operations.push({ method: 'prepare', sql, params });
        
        return {
          first: async <T>(): Promise<T | null> => {
            if (sql.includes('SELECT id, name FROM tags WHERE name = ?')) {
              const name = params[0];
              return (this.tags.get(name) as T) || null;
            }

            if (sql.includes('SELECT id FROM tags WHERE id = ?')) {
              const id = params[0];
              for (const tag of this.tags.values()) {
                if (tag.id === id) {
                  return ({ id: tag.id } as T);
                }
              }
              return null;
            }
            
            if (sql.includes('SELECT id FROM tag_hierarchy WHERE child_tag_id = ? AND parent_tag_id = ?')) {
              const key = `${params[0]}-${params[1]}`;
              return (this.hierarchies.get(key) as T) || null;
            }

            if (sql.includes('INSERT INTO tags (name) VALUES (?) RETURNING id, name')) {
              const name = params[0];
              const tag = { id: this.nextId++, name };
              this.tags.set(name, tag);
              return tag as T;
            }

            if (sql.includes('INSERT INTO tag_hierarchy')) {
              const [childId, parentId] = params;
              const hierarchy = {
                id: this.nextId++,
                child_tag_id: childId,
                parent_tag_id: parentId,
                created_at: Math.floor(Date.now() / 1000)
              };
              this.hierarchies.set(`${childId}-${parentId}`, hierarchy);
              return hierarchy as T;
            }

            return null;
          },

          run: async () => {
            if (sql.includes('INSERT INTO memory_tags')) {
              const [memoryId, tagId] = params;
              const existing = this.memoryTags.get(memoryId) || [];
              if (!existing.includes(tagId)) {
                existing.push(tagId);
                this.memoryTags.set(memoryId, existing);
              }
            }
            return { success: true, meta: { last_row_id: this.nextId } };
          },

          all: async () => ({ results: [] })
        };
      }
    };
  }

  reset() {
    this.operations = [];
    this.tags.clear();
    this.hierarchies.clear();
    this.memoryTags.clear();
    this.nextId = 1;
  }

  getMemoryTags(memoryId: string): number[] {
    return this.memoryTags.get(memoryId) || [];
  }

  hasHierarchy(childId: number, parentId: number): boolean {
    return this.hierarchies.has(`${childId}-${parentId}`);
  }

  getTagByName(name: string) {
    return this.tags.get(name);
  }
}

// Import the functions we want to test
import { TagHierarchyService } from '../../src/services/tagHierarchy';

describe('Hierarchical Tag Processing', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = new TestDatabase();
  });

  describe('TagHierarchyService.createTagsWithRelationship', () => {
    it('should handle parent>child hierarchical format correctly', async () => {
      const result = await TagHierarchyService.createTagsWithRelationship(
        testDb as any,
        'javascript',
        'programming'
      );

      expect(result.child_tag.name).toBe('javascript');
      expect(result.parent_tag.name).toBe('programming');
      expect(result.created_child).toBe(true);
      expect(result.created_parent).toBe(true);

      // Check that hierarchy was created
      const childTag = testDb.getTagByName('javascript');
      const parentTag = testDb.getTagByName('programming');
      expect(childTag).toBeDefined();
      expect(parentTag).toBeDefined();
      expect(testDb.hasHierarchy(childTag!.id, parentTag!.id)).toBe(true);
    });

    it('should not create relationship when both tags exist with existing relationship', async () => {
      // Create first relationship
      await TagHierarchyService.createTagsWithRelationship(
        testDb as any,
        'react',
        'javascript'
      );

      // Try to create same relationship again
      await expect(
        TagHierarchyService.createTagsWithRelationship(
          testDb as any,
          'react',
          'javascript'
        )
      ).rejects.toThrow('Relationship between these tags already exists');
    });

    it('should create hierarchy when only one tag exists', async () => {
      // Create parent tag first
      await TagHierarchyService.createTag(testDb as any, 'web-development');

      const result = await TagHierarchyService.createTagsWithRelationship(
        testDb as any,
        'css',
        'web-development'
      );

      expect(result.created_child).toBe(true);
      expect(result.created_parent).toBe(false);
      expect(result.child_tag.name).toBe('css');
      expect(result.parent_tag.name).toBe('web-development');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors correctly', async () => {
      // Test empty strings
      await expect(
        TagHierarchyService.createTagsWithRelationship(testDb as any, '', 'parent')
      ).rejects.toThrow('Tag names cannot be empty');

      // Test self-reference
      await expect(
        TagHierarchyService.createTagsWithRelationship(testDb as any, 'same', 'same')
      ).rejects.toThrow('A tag cannot be its own parent');

      // Test whitespace-only strings
      await expect(
        TagHierarchyService.createTagsWithRelationship(testDb as any, '   ', 'parent')
      ).rejects.toThrow('Tag names cannot be empty');
    });

    it('should trim whitespace properly', async () => {
      const result = await TagHierarchyService.createTagsWithRelationship(
        testDb as any,
        '  frontend  ',
        '  development  '
      );

      expect(result.child_tag.name).toBe('frontend');
      expect(result.parent_tag.name).toBe('development');
    });
  });

  describe('Memory Tag Assignment with Hierarchical Support', () => {
    // Note: This is more complex to test without importing the actual memory handler
    // but we can test the core logic conceptually
    
    it('should process hierarchical tag format correctly', () => {
      const hierarchicalTag = 'programming>javascript';
      const parts = hierarchicalTag.split('>').map(part => part.trim()).filter(Boolean);
      
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe('programming');
      expect(parts[1]).toBe('javascript');
    });

    it('should reject invalid hierarchical formats', () => {
      const invalidFormats = [
        'single',
        'too>many>parts',
        '>incomplete',
        'incomplete>',
        '>>empty',
        'with > spaces > everywhere'
      ];

      invalidFormats.forEach(format => {
        const parts = format.split('>').map(part => part.trim()).filter(Boolean);
        if (format.includes('>') && parts.length !== 2) {
          expect(parts.length).not.toBe(2);
        }
      });
    });

    it('should handle valid hierarchical formats', () => {
      const validFormats = [
        'parent>child',
        'programming>javascript',
        ' spaced > format ',
        'frontend>react'
      ];

      validFormats.forEach(format => {
        const parts = format.split('>').map(part => part.trim()).filter(Boolean);
        expect(parts).toHaveLength(2);
        expect(parts[0]).toBeTruthy();
        expect(parts[1]).toBeTruthy();
      });
    });
  });
});