import {
  Tag,
  TagTreeNode,
  AddParentRequest,
  TagHierarchyResponse,
  AncestorsResponse,
  DescendantsResponse,
  TagTreeResponse,
  ParentsResponse,
  ChildrenResponse
} from '../types/tags';

const API_BASE = '/api/tags';

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
      const response = await fetch(`${API_BASE}/${childTagId}/parent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent_tag_id: parentTagId,
        } as AddParentRequest),
      });

      if (!response.ok) {
        const errorData = await response.json() as TagHierarchyResponse;
        throw new TagHierarchyApiError(
          errorData.error || `Failed to add parent: ${response.statusText}`,
          response.status
        );
      }

      const data: TagHierarchyResponse = await response.json();
      if (!data.success) {
        throw new TagHierarchyApiError(data.error || 'Unknown error occurred');
      }

      return data.data;
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
      const response = await fetch(`${API_BASE}/${childTagId}/parent/${parentTagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json() as TagHierarchyResponse;
        throw new TagHierarchyApiError(
          errorData.error || `Failed to remove parent: ${response.statusText}`,
          response.status
        );
      }

      const data: TagHierarchyResponse = await response.json();
      if (!data.success) {
        throw new TagHierarchyApiError(data.error || 'Unknown error occurred');
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
      const response = await fetch(`${API_BASE}/${tagId}/ancestors`);

      if (!response.ok) {
        const errorData = await response.json() as TagHierarchyResponse;
        throw new TagHierarchyApiError(
          errorData.error || `Failed to fetch ancestors: ${response.statusText}`,
          response.status
        );
      }

      const data: AncestorsResponse = await response.json();
      return data.ancestors;
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
      const response = await fetch(`${API_BASE}/${tagId}/descendants`);

      if (!response.ok) {
        const errorData = await response.json() as TagHierarchyResponse;
        throw new TagHierarchyApiError(
          errorData.error || `Failed to fetch descendants: ${response.statusText}`,
          response.status
        );
      }

      const data: DescendantsResponse = await response.json();
      return data.descendants;
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
      const response = await fetch(`${API_BASE}/${tagId}/parents`);

      if (!response.ok) {
        const errorData = await response.json() as TagHierarchyResponse;
        throw new TagHierarchyApiError(
          errorData.error || `Failed to fetch parents: ${response.statusText}`,
          response.status
        );
      }

      const data: ParentsResponse = await response.json();
      if (!data.success || !data.data) {
        throw new TagHierarchyApiError(data.error || 'Failed to fetch parents');
      }

      return data.data.parents;
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
      const response = await fetch(`${API_BASE}/${tagId}/children`);

      if (!response.ok) {
        const errorData = await response.json() as TagHierarchyResponse;
        throw new TagHierarchyApiError(
          errorData.error || `Failed to fetch children: ${response.statusText}`,
          response.status
        );
      }

      const data: ChildrenResponse = await response.json();
      if (!data.success || !data.data) {
        throw new TagHierarchyApiError(data.error || 'Failed to fetch children');
      }

      return data.data.children;
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
      const response = await fetch(`${API_BASE}/tree`);

      if (!response.ok) {
        const errorData = await response.json() as TagHierarchyResponse;
        throw new TagHierarchyApiError(
          errorData.error || `Failed to fetch tag tree: ${response.statusText}`,
          response.status
        );
      }

      const data: TagTreeResponse = await response.json();
      return data.tree;
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