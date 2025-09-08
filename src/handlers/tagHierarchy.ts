import { Context } from 'hono';
import type { Env } from '../index';
import { TagHierarchyService } from '../services/tagHierarchy';
import {
  TagHierarchyError,
  TagNotFoundError
} from '../errors/tagHierarchyErrors';
import {
  AddParentRequest,
  TagHierarchyResponse,
  AncestorsResponse,
  DescendantsResponse,
  TagTreeResponse,
  CreateTagsWithRelationshipRequest,
  CreateTagsWithRelationshipResponse
} from '../../types/index';

/**
 * Create tags with parent-child relationship
 * POST /api/tags/create-with-parent
 */
export async function createTagsWithRelationship(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<CreateTagsWithRelationshipRequest>();
    
    // Validate required fields
    if (!body.child_tag_name || !body.parent_tag_name) {
      return c.json<CreateTagsWithRelationshipResponse>({
        success: false,
        error: 'Missing required fields: child_tag_name and parent_tag_name are required'
      }, 400);
    }

    // Validate tag names are not empty strings
    if (!body.child_tag_name.trim() || !body.parent_tag_name.trim()) {
      return c.json<CreateTagsWithRelationshipResponse>({
        success: false,
        error: 'Tag names cannot be empty'
      }, 400);
    }

    // Prevent self-reference
    if (body.child_tag_name.trim() === body.parent_tag_name.trim()) {
      return c.json<CreateTagsWithRelationshipResponse>({
        success: false,
        error: 'A tag cannot be its own parent'
      }, 400);
    }

    const result = await TagHierarchyService.createTagsWithRelationship(
      c.env.DB,
      body.child_tag_name,
      body.parent_tag_name
    );

    return c.json<CreateTagsWithRelationshipResponse>({
      success: true,
      data: result
    }, 201);

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Add a parent relationship to a tag
 * POST /api/tags/:id/parent
 */
export async function addParent(c: Context<{ Bindings: Env }>) {
  try {
    const childTagId = parseInt(c.req.param('id'));
    
    if (isNaN(childTagId)) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Invalid child tag ID'
      }, 400);
    }

    const body = await c.req.json<AddParentRequest>();
    
    if (!body.parent_tag_id || isNaN(body.parent_tag_id)) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Invalid or missing parent_tag_id'
      }, 400);
    }

    const hierarchy = await TagHierarchyService.addParent(
      c.env.DB,
      childTagId,
      body.parent_tag_id
    );

    return c.json<TagHierarchyResponse>({
      success: true,
      data: hierarchy
    }, 201);

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Remove a parent relationship from a tag
 * DELETE /api/tags/:id/parent/:parentId
 */
export async function removeParent(c: Context<{ Bindings: Env }>) {
  try {
    const childTagId = parseInt(c.req.param('id'));
    const parentTagId = parseInt(c.req.param('parentId'));

    if (isNaN(childTagId) || isNaN(parentTagId)) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Invalid tag IDs'
      }, 400);
    }

    const removed = await TagHierarchyService.removeParent(
      c.env.DB,
      childTagId,
      parentTagId
    );

    if (!removed) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Parent relationship not found'
      }, 404);
    }

    return c.json<TagHierarchyResponse>({
      success: true,
      data: { removed: true }
    });

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Get all ancestor tags for a tag
 * GET /api/tags/:id/ancestors
 */
export async function getAncestors(c: Context<{ Bindings: Env }>) {
  try {
    const tagId = parseInt(c.req.param('id'));

    if (isNaN(tagId)) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Invalid tag ID'
      }, 400);
    }

    // Verify tag exists
    const tagExists = await TagHierarchyService.tagExists(c.env.DB, tagId);
    if (!tagExists) {
      throw new TagNotFoundError(tagId);
    }

    const ancestors = await TagHierarchyService.getAncestors(c.env.DB, tagId);

    return c.json<AncestorsResponse>({
      tag_id: tagId,
      ancestors
    });

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Get all descendant tags for a tag
 * GET /api/tags/:id/descendants
 */
export async function getDescendants(c: Context<{ Bindings: Env }>) {
  try {
    const tagId = parseInt(c.req.param('id'));

    if (isNaN(tagId)) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Invalid tag ID'
      }, 400);
    }

    // Verify tag exists
    const tagExists = await TagHierarchyService.tagExists(c.env.DB, tagId);
    if (!tagExists) {
      throw new TagNotFoundError(tagId);
    }

    const descendants = await TagHierarchyService.getDescendants(c.env.DB, tagId);

    return c.json<DescendantsResponse>({
      tag_id: tagId,
      descendants
    });

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Get the complete tag hierarchy tree
 * GET /api/tags/tree
 */
export async function getTagTree(c: Context<{ Bindings: Env }>) {
  try {
    const tree = await TagHierarchyService.getTagTree(c.env.DB);

    return c.json<TagTreeResponse>({
      tree
    });

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Get immediate parents of a tag
 * GET /api/tags/:id/parents
 */
export async function getImmediateParents(c: Context<{ Bindings: Env }>) {
  try {
    const tagId = parseInt(c.req.param('id'));

    if (isNaN(tagId)) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Invalid tag ID'
      }, 400);
    }

    // Verify tag exists
    const tagExists = await TagHierarchyService.tagExists(c.env.DB, tagId);
    if (!tagExists) {
      throw new TagNotFoundError(tagId);
    }

    const parents = await TagHierarchyService.getImmediateParents(c.env.DB, tagId);

    return c.json<TagHierarchyResponse>({
      success: true,
      data: { tag_id: tagId, parents }
    });

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Get immediate children of a tag
 * GET /api/tags/:id/children
 */
export async function getImmediateChildren(c: Context<{ Bindings: Env }>) {
  try {
    const tagId = parseInt(c.req.param('id'));

    if (isNaN(tagId)) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Invalid tag ID'
      }, 400);
    }

    // Verify tag exists
    const tagExists = await TagHierarchyService.tagExists(c.env.DB, tagId);
    if (!tagExists) {
      throw new TagNotFoundError(tagId);
    }

    const children = await TagHierarchyService.getImmediateChildren(c.env.DB, tagId);

    return c.json<TagHierarchyResponse>({
      success: true,
      data: { tag_id: tagId, children }
    });

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Centralized error handling for tag hierarchy operations
 */
function handleTagHierarchyError(error: unknown, c: Context<{ Bindings: Env }>) {
  console.error('Tag hierarchy error:', error);

  if (error instanceof TagHierarchyError) {
    return c.json<TagHierarchyResponse>({
      success: false,
      error: error.message
    }, error.statusCode as any);
  }

  // Handle database constraint violations
  if (error instanceof Error) {
    if (error.message.includes('Circular reference detected')) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Circular reference detected: Cannot create hierarchy that would result in a cycle'
      }, 400);
    }

    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Invalid tag ID: One or both tags do not exist'
      }, 400);
    }

    if (error.message.includes('UNIQUE constraint failed')) {
      return c.json<TagHierarchyResponse>({
        success: false,
        error: 'Parent relationship already exists'
      }, 409);
    }
  }

  // Generic error fallback
  return c.json<TagHierarchyResponse>({
    success: false,
    error: 'Internal server error'
  }, 500);
}