import {
  Tag,
  TagTreeNode,
  AddParentRequest,
  AncestorsResponse,
  DescendantsResponse,
  TagTreeResponse,
  ParentsResponse,
  ChildrenResponse,
  CreateTagsWithParentRequest,
  CreateTagsWithParentResponse
} from '../types/tags';
import { api } from './client';

class TagHierarchyApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'TagHierarchyApiError';
  }
}

/**
 * API client for tag hierarchy operations
 */
export class TagHierarchyApi {
  /**
   * Add a parent relationship to a tag
   */
  static async addParent(childTagId: number, parentTagId: number): Promise<any> {
    try {
      const response = await api.post(`/tags/${childTagId}/parent`, {
        parent_tag_id: parentTagId,
      } as AddParentRequest);

      if (!response.success) {
        throw new TagHierarchyApiError(response.error || 'Failed to add parent');
      }

      return response.data;
    } catch (error) {
      if (error instanceof TagHierarchyApiError) {
        throw error;
      }
      throw new TagHierarchyApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  /**
   * Remove a parent relationship from a tag
   */
  static async removeParent(childTagId: number, parentTagId: number): Promise<boolean> {
    try {
      const response = await api.delete(`/tags/${childTagId}/parent/${parentTagId}`);

      if (!response.success) {
        throw new TagHierarchyApiError(response.error || 'Failed to remove parent');
      }

      return true;
    } catch (error) {
      if (error instanceof TagHierarchyApiError) {
        throw error;
      }
      throw new TagHierarchyApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  /**
   * Get all ancestor tags for a tag
   */
  static async getAncestors(tagId: number): Promise<Tag[]> {
    try {
      const response = await api.get<AncestorsResponse>(`/tags/${tagId}/ancestors`);

      if (!response.success || !response.data) {
        throw new TagHierarchyApiError(response.error || 'Failed to fetch ancestors');
      }

      return (response.data as any).ancestors || [];
    } catch (error) {
      if (error instanceof TagHierarchyApiError) {
        throw error;
      }
      throw new TagHierarchyApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  /**
   * Get all descendant tags for a tag
   */
  static async getDescendants(tagId: number): Promise<Tag[]> {
    try {
      const response = await api.get<DescendantsResponse>(`/tags/${tagId}/descendants`);

      if (!response.success || !response.data) {
        throw new TagHierarchyApiError(response.error || 'Failed to fetch descendants');
      }

      return (response.data as any).descendants || [];
    } catch (error) {
      if (error instanceof TagHierarchyApiError) {
        throw error;
      }
      throw new TagHierarchyApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  /**
   * Get immediate parents of a tag
   */
  static async getParents(tagId: number): Promise<Tag[]> {
    try {
      const response = await api.get<ParentsResponse>(`/tags/${tagId}/parents`);

      if (!response.success || !response.data) {
        throw new TagHierarchyApiError(response.error || 'Failed to fetch parents');
      }

      return (response.data as any).parents || [];
    } catch (error) {
      if (error instanceof TagHierarchyApiError) {
        throw error;
      }
      throw new TagHierarchyApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  /**
   * Get immediate children of a tag
   */
  static async getChildren(tagId: number): Promise<Tag[]> {
    try {
      const response = await api.get<ChildrenResponse>(`/tags/${tagId}/children`);

      if (!response.success || !response.data) {
        throw new TagHierarchyApiError(response.error || 'Failed to fetch children');
      }

      return (response.data as any).children || [];
    } catch (error) {
      if (error instanceof TagHierarchyApiError) {
        throw error;
      }
      throw new TagHierarchyApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  /**
   * Get the complete tag hierarchy tree
   */
  static async getTagTree(): Promise<TagTreeNode[]> {
    try {
      const response = await api.get<TagTreeResponse>('/tags/tree');

      if (!response.success || !response.data) {
        throw new TagHierarchyApiError(response.error || 'Failed to fetch tag tree');
      }

      return (response.data as any).tree || [];
    } catch (error) {
      if (error instanceof TagHierarchyApiError) {
        throw error;
      }
      throw new TagHierarchyApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  /**
   * Create tags with parent-child relationship
   */
  static async createTagsWithParent(
    childName: string,
    parentName: string
  ): Promise<CreateTagsWithParentResponse> {
    try {
      const response = await api.post<CreateTagsWithParentResponse>('/tags/create-with-parent', {
        child_tag_name: childName,
        parent_tag_name: parentName,
      } as CreateTagsWithParentRequest);

      if (!response.success || !response.data) {
        throw new TagHierarchyApiError(response.error || 'Failed to create tags with parent');
      }

      return response.data;
    } catch (error) {
      if (error instanceof TagHierarchyApiError) {
        throw error;
      }
      throw new TagHierarchyApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }
}

export { TagHierarchyApiError };
