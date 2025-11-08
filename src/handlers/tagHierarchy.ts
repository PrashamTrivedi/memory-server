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
  CreateTagsWithRelationshipRequest
} from '../../types/index';
import { sendFormattedResponse, prefersMarkdown } from '../utils/responseFormatter';
import {
  formatTagRelationshipAsMarkdown,
  formatTagTreeAsMarkdown,
  formatTagListAsMarkdown,
  formatSuccessResponse,
  formatErrorResponse
} from '../mcp/utils/formatters';

/**
 * Create tags with parent-child relationship
 * POST /api/tags/create-with-parent
 */
export async function createTagsWithRelationship(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<CreateTagsWithRelationshipRequest>();
    
    // Validate required fields
    if (!body.child_tag_name || !body.parent_tag_name) {
      return returnValidationError(c, 'Missing required fields: child_tag_name and parent_tag_name are required');
    }

    // Validate tag names are not empty strings
    if (!body.child_tag_name.trim() || !body.parent_tag_name.trim()) {
      return returnValidationError(c, 'Tag names cannot be empty');
    }

    // Prevent self-reference
    if (body.child_tag_name.trim() === body.parent_tag_name.trim()) {
      return returnValidationError(c, 'A tag cannot be its own parent');
    }

    const result = await TagHierarchyService.createTagsWithRelationship(
      c.env.DB,
      body.child_tag_name,
      body.parent_tag_name
    );

    // Format response based on Accept header
    const markdown = formatTagRelationshipAsMarkdown(result);
    const jsonData = {
      success: true,
      data: result
    };

    return sendFormattedResponse(c, markdown, jsonData, 201);

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
      return returnValidationError(c, 'Invalid child tag ID');
    }

    const body = await c.req.json<AddParentRequest>();

    if (!body.parent_tag_id || isNaN(body.parent_tag_id)) {
      return returnValidationError(c, 'Invalid or missing parent_tag_id');
    }

    const hierarchy = await TagHierarchyService.addParent(
      c.env.DB,
      childTagId,
      body.parent_tag_id
    );

    // Format response based on Accept header
    const markdown = formatSuccessResponse('Parent relationship created successfully', hierarchy);
    const jsonData = {
      success: true,
      data: hierarchy
    };

    return sendFormattedResponse(c, markdown, jsonData, 201);

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
      return returnValidationError(c, 'Invalid tag IDs');
    }

    const removed = await TagHierarchyService.removeParent(
      c.env.DB,
      childTagId,
      parentTagId
    );

    if (!removed) {
      return returnValidationError(c, 'Parent relationship not found', 404);
    }

    // Format response based on Accept header
    const markdown = formatSuccessResponse('Parent relationship removed successfully', { removed: true });
    const jsonData = {
      success: true,
      data: { removed: true }
    };

    return sendFormattedResponse(c, markdown, jsonData);

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
      return returnValidationError(c, 'Invalid tag ID');
    }

    // Verify tag exists
    const tagExists = await TagHierarchyService.tagExists(c.env.DB, tagId);
    if (!tagExists) {
      throw new TagNotFoundError(tagId);
    }

    const ancestors = await TagHierarchyService.getAncestors(c.env.DB, tagId);

    // Get tag name for context
    const tagResult = await c.env.DB.prepare('SELECT name FROM tags WHERE id = ?').bind(tagId).first<{ name: string }>();
    const tagName = tagResult?.name;

    // Format response based on Accept header
    const markdown = formatTagListAsMarkdown('Ancestor Tags', ancestors, { id: tagId, name: tagName });
    const jsonData = {
      tag_id: tagId,
      ancestors
    };

    return sendFormattedResponse(c, markdown, jsonData);

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
      return returnValidationError(c, 'Invalid tag ID');
    }

    // Verify tag exists
    const tagExists = await TagHierarchyService.tagExists(c.env.DB, tagId);
    if (!tagExists) {
      throw new TagNotFoundError(tagId);
    }

    const descendants = await TagHierarchyService.getDescendants(c.env.DB, tagId);

    // Get tag name for context
    const tagResult = await c.env.DB.prepare('SELECT name FROM tags WHERE id = ?').bind(tagId).first<{ name: string }>();
    const tagName = tagResult?.name;

    // Format response based on Accept header
    const markdown = formatTagListAsMarkdown('Descendant Tags', descendants, { id: tagId, name: tagName });
    const jsonData = {
      tag_id: tagId,
      descendants
    };

    return sendFormattedResponse(c, markdown, jsonData);

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

    // Format response based on Accept header
    const markdown = formatTagTreeAsMarkdown(tree);
    const jsonData = {
      tree
    };

    return sendFormattedResponse(c, markdown, jsonData);

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
      return returnValidationError(c, 'Invalid tag ID');
    }

    // Verify tag exists
    const tagExists = await TagHierarchyService.tagExists(c.env.DB, tagId);
    if (!tagExists) {
      throw new TagNotFoundError(tagId);
    }

    const parents = await TagHierarchyService.getImmediateParents(c.env.DB, tagId);

    // Get tag name for context
    const tagResult = await c.env.DB.prepare('SELECT name FROM tags WHERE id = ?').bind(tagId).first<{ name: string }>();
    const tagName = tagResult?.name;

    // Format response based on Accept header
    const markdown = formatTagListAsMarkdown('Immediate Parents', parents, { id: tagId, name: tagName });
    const jsonData = {
      success: true,
      data: { tag_id: tagId, parents }
    };

    return sendFormattedResponse(c, markdown, jsonData);

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
      return returnValidationError(c, 'Invalid tag ID');
    }

    // Verify tag exists
    const tagExists = await TagHierarchyService.tagExists(c.env.DB, tagId);
    if (!tagExists) {
      throw new TagNotFoundError(tagId);
    }

    const children = await TagHierarchyService.getImmediateChildren(c.env.DB, tagId);

    // Get tag name for context
    const tagResult = await c.env.DB.prepare('SELECT name FROM tags WHERE id = ?').bind(tagId).first<{ name: string }>();
    const tagName = tagResult?.name;

    // Format response based on Accept header
    const markdown = formatTagListAsMarkdown('Immediate Children', children, { id: tagId, name: tagName });
    const jsonData = {
      success: true,
      data: { tag_id: tagId, children }
    };

    return sendFormattedResponse(c, markdown, jsonData);

  } catch (error) {
    return handleTagHierarchyError(error, c);
  }
}

/**
 * Return validation error with proper content negotiation
 */
function returnValidationError(c: Context<{ Bindings: Env }>, errorMessage: string, statusCode: number = 400) {
  if (prefersMarkdown(c)) {
    const markdown = formatErrorResponse(errorMessage);
    return c.text(markdown, statusCode as any, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  }

  return c.json<TagHierarchyResponse>({
    success: false,
    error: errorMessage
  }, statusCode as any);
}

/**
 * Centralized error handling for tag hierarchy operations
 */
function handleTagHierarchyError(error: unknown, c: Context<{ Bindings: Env }>) {
  console.error('Tag hierarchy error:', error);

  let errorMessage = 'Internal server error';
  let statusCode = 500;

  if (error instanceof TagHierarchyError) {
    errorMessage = error.message;
    statusCode = error.statusCode as any;
  } else if (error instanceof Error) {
    // Handle database constraint violations
    if (error.message.includes('Circular reference detected')) {
      errorMessage = 'Circular reference detected: Cannot create hierarchy that would result in a cycle';
      statusCode = 400;
    } else if (error.message.includes('FOREIGN KEY constraint failed')) {
      errorMessage = 'Invalid tag ID: One or both tags do not exist';
      statusCode = 400;
    } else if (error.message.includes('UNIQUE constraint failed')) {
      errorMessage = 'Parent relationship already exists';
      statusCode = 409;
    }
  }

  // Format response based on Accept header
  if (prefersMarkdown(c)) {
    const markdown = formatErrorResponse(errorMessage);
    return c.text(markdown, statusCode as any, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  }

  return c.json<TagHierarchyResponse>({
    success: false,
    error: errorMessage
  }, statusCode as any);
}