import { describe, it, expect, beforeEach } from 'vitest';
import { createTagsWithRelationship } from '../../src/handlers/tagHierarchy';
import { CreateTagsWithRelationshipRequest, CreateTagsWithRelationshipResponse } from '../../types/index';

// Mock Hono Context
class MockContext {
  private jsonData: any;
  private status: number = 200;
  private _env: any;

  constructor(env: any, private reqBody?: any) {
    this._env = env;
  }

  get req() {
    return {
      json: async () => this.reqBody
    };
  }

  get env() {
    return this._env;
  }

  json<T>(data: T, statusCode?: number): T {
    if (statusCode) this.status = statusCode;
    return data;
  }

  getResponse() {
    return {
      data: this.jsonData,
      status: this.status
    };
  }
}

import { vi } from 'vitest';

// Mock TagHierarchyService
vi.mock('../../src/services/tagHierarchy', () => ({
  TagHierarchyService: {
    createTagsWithRelationship: async (db: any, child: string, parent: string) => {
      if (child === parent) {
        throw new Error('A tag cannot be its own parent');
      }
      if (child === 'existing-child' && parent === 'existing-parent') {
        throw new Error('Relationship between these tags already exists');
      }
      if (child.includes('circular')) {
        throw new Error('Circular reference detected');
      }
      
      return {
        child_tag: { id: 1, name: child },
        parent_tag: { id: 2, name: parent },
        hierarchy: { id: 1, child_tag_id: 1, parent_tag_id: 2, created_at: Date.now() },
        created_child: true,
        created_parent: true
      };
    }
  }
}));

describe('Tag Hierarchy API', () => {
  const mockEnv = { DB: {} };

  describe('POST /api/tags/create-with-parent', () => {
    it('should successfully create tags with relationship', async () => {
      const requestBody: CreateTagsWithRelationshipRequest = {
        child_tag_name: 'child-tag',
        parent_tag_name: 'parent-tag'
      };

      const mockContext = new MockContext(mockEnv, requestBody);
      const result = await createTagsWithRelationship(mockContext as any);

      const expected: CreateTagsWithRelationshipResponse = {
        success: true,
        data: {
          child_tag: { id: 1, name: 'child-tag' },
          parent_tag: { id: 2, name: 'parent-tag' },
          hierarchy: expect.objectContaining({
            id: 1,
            child_tag_id: 1,
            parent_tag_id: 2
          }),
          created_child: true,
          created_parent: true
        }
      };

      expect(result).toMatchObject(expected);
    });

    it('should return 400 for missing child_tag_name', async () => {
      const requestBody = {
        parent_tag_name: 'parent-tag'
        // Missing child_tag_name
      };

      const mockContext = new MockContext(mockEnv, requestBody);
      const result = await createTagsWithRelationship(mockContext as any);

      expect(result).toEqual({
        success: false,
        error: 'Missing required fields: child_tag_name and parent_tag_name are required'
      });
    });

    it('should return 400 for missing parent_tag_name', async () => {
      const requestBody = {
        child_tag_name: 'child-tag'
        // Missing parent_tag_name
      };

      const mockContext = new MockContext(mockEnv, requestBody);
      const result = await createTagsWithRelationship(mockContext as any);

      expect(result).toEqual({
        success: false,
        error: 'Missing required fields: child_tag_name and parent_tag_name are required'
      });
    });

    it('should return 400 for empty child_tag_name', async () => {
      const requestBody: CreateTagsWithRelationshipRequest = {
        child_tag_name: '   ',
        parent_tag_name: 'parent-tag'
      };

      const mockContext = new MockContext(mockEnv, requestBody);
      const result = await createTagsWithRelationship(mockContext as any);

      expect(result).toEqual({
        success: false,
        error: 'Tag names cannot be empty'
      });
    });

    it('should return 400 for empty parent_tag_name', async () => {
      const requestBody: CreateTagsWithRelationshipRequest = {
        child_tag_name: 'child-tag',
        parent_tag_name: ''
      };

      const mockContext = new MockContext(mockEnv, requestBody);
      const result = await createTagsWithRelationship(mockContext as any);

      expect(result).toEqual({
        success: false,
        error: 'Missing required fields: child_tag_name and parent_tag_name are required'
      });
    });

    it('should return 400 for self-reference', async () => {
      const requestBody: CreateTagsWithRelationshipRequest = {
        child_tag_name: 'same-tag',
        parent_tag_name: 'same-tag'
      };

      const mockContext = new MockContext(mockEnv, requestBody);
      const result = await createTagsWithRelationship(mockContext as any);

      expect(result).toEqual({
        success: false,
        error: 'A tag cannot be its own parent'
      });
    });

    it('should handle existing relationship error', async () => {
      const requestBody: CreateTagsWithRelationshipRequest = {
        child_tag_name: 'existing-child',
        parent_tag_name: 'existing-parent'
      };

      const mockContext = new MockContext(mockEnv, requestBody);
      const result = await createTagsWithRelationship(mockContext as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });

    it('should handle circular reference error', async () => {
      const requestBody: CreateTagsWithRelationshipRequest = {
        child_tag_name: 'circular-child',
        parent_tag_name: 'circular-parent'
      };

      const mockContext = new MockContext(mockEnv, requestBody);
      const result = await createTagsWithRelationship(mockContext as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular reference');
    });
  });
});