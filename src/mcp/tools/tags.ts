import type { Env } from '../../index.js';
import { createDualFormatResponse } from '../utils/formatters.js';

/**
 * Tag with hierarchy and memory count
 */
interface TagWithMetadata {
  id: number;
  name: string;
  parent_id: number | null;
  memory_count: number;
}

/**
 * Format tag list as markdown for MCP response
 */
function formatTagsListAsMarkdown(tags: TagWithMetadata[]): string {
  if (tags.length === 0) {
    return `# Tags

No tags found.`;
  }

  // Build hierarchy map
  const childrenMap = new Map<number | null, TagWithMetadata[]>();
  for (const tag of tags) {
    const parentId = tag.parent_id;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(tag);
  }

  // Render tree recursively
  function renderTree(parentId: number | null, depth: number): string {
    const children = childrenMap.get(parentId) || [];
    let result = '';
    const indent = '  '.repeat(depth);

    for (const tag of children) {
      result += `${indent}- **${tag.name}** (ID: ${tag.id}, ${tag.memory_count} memories)\n`;
      result += renderTree(tag.id, depth + 1);
    }

    return result;
  }

  let markdown = `# Tags

**Total**: ${tags.length} tags

## Tag Hierarchy

`;
  markdown += renderTree(null, 0);

  // Also list orphaned tags (those with parent_id pointing to non-existent tags)
  const allIds = new Set(tags.map(t => t.id));
  const orphans = tags.filter(t => t.parent_id !== null && !allIds.has(t.parent_id));
  if (orphans.length > 0) {
    markdown += `\n## Orphaned Tags\n\n`;
    for (const tag of orphans) {
      markdown += `- **${tag.name}** (ID: ${tag.id}, parent: ${tag.parent_id})\n`;
    }
  }

  return markdown;
}

/**
 * MCP Tool: List Tags
 * Lists all tags with hierarchy relationships and memory counts
 */
export async function handleListTags(env: Env): Promise<any> {
  const result = await env.DB.prepare(`
    SELECT t.id, t.name, th.parent_id,
           (SELECT COUNT(*) FROM memory_tags WHERE tag_id = t.id) as memory_count
    FROM tags t
    LEFT JOIN tag_hierarchy th ON t.id = th.child_id
    ORDER BY t.name
  `).all<TagWithMetadata>();

  const tags = result.results || [];

  const markdown = formatTagsListAsMarkdown(tags);
  const structuredData = {
    success: true,
    data: { tags }
  };

  return createDualFormatResponse(markdown, structuredData);
}

/**
 * MCP Tool: Rename Tag
 * Renames an existing tag
 */
export async function handleRenameTag(
  env: Env,
  args: { tagId: number; newName: string }
): Promise<any> {
  const { tagId, newName } = args;

  // Check tag exists
  const existing = await env.DB.prepare('SELECT id, name FROM tags WHERE id = ?')
    .bind(tagId).first<{ id: number; name: string }>();

  if (!existing) {
    throw new Error(`Tag with ID ${tagId} not found`);
  }

  // Check new name doesn't conflict
  const conflict = await env.DB.prepare('SELECT id FROM tags WHERE name = ? AND id != ?')
    .bind(newName, tagId).first();

  if (conflict) {
    throw new Error(`Tag with name "${newName}" already exists`);
  }

  const oldName = existing.name;

  await env.DB.prepare('UPDATE tags SET name = ? WHERE id = ?')
    .bind(newName, tagId).run();

  const markdown = `✅ Tag Renamed

**Old Name**: ${oldName}
**New Name**: ${newName}
**Tag ID**: ${tagId}`;

  const structuredData = {
    success: true,
    data: { tagId, oldName, newName }
  };

  return createDualFormatResponse(markdown, structuredData);
}

/**
 * MCP Tool: Merge Tags
 * Merges one tag into another, moving all memory associations
 */
export async function handleMergeTags(
  env: Env,
  args: { sourceTagId: number; targetTagId: number }
): Promise<any> {
  const { sourceTagId, targetTagId } = args;

  if (sourceTagId === targetTagId) {
    throw new Error('Source and target tags must be different');
  }

  // Verify both tags exist
  const sourceTag = await env.DB.prepare('SELECT id, name FROM tags WHERE id = ?')
    .bind(sourceTagId).first<{ id: number; name: string }>();
  const targetTag = await env.DB.prepare('SELECT id, name FROM tags WHERE id = ?')
    .bind(targetTagId).first<{ id: number; name: string }>();

  if (!sourceTag) {
    throw new Error(`Source tag with ID ${sourceTagId} not found`);
  }
  if (!targetTag) {
    throw new Error(`Target tag with ID ${targetTagId} not found`);
  }

  // Count memories being moved
  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM memory_tags WHERE tag_id = ?'
  ).bind(sourceTagId).first<{ count: number }>();
  const memoriesAffected = countResult?.count || 0;

  // Move memory associations from source to target (ignore duplicates)
  await env.DB.prepare(`
    INSERT OR IGNORE INTO memory_tags (memory_id, tag_id)
    SELECT memory_id, ? FROM memory_tags WHERE tag_id = ?
  `).bind(targetTagId, sourceTagId).run();

  // Delete source tag associations
  await env.DB.prepare('DELETE FROM memory_tags WHERE tag_id = ?')
    .bind(sourceTagId).run();

  // Update hierarchy: children of source become children of target
  await env.DB.prepare('UPDATE tag_hierarchy SET parent_id = ? WHERE parent_id = ?')
    .bind(targetTagId, sourceTagId).run();

  // Remove source from hierarchy as child
  await env.DB.prepare('DELETE FROM tag_hierarchy WHERE child_id = ?')
    .bind(sourceTagId).run();

  // Delete source tag
  await env.DB.prepare('DELETE FROM tags WHERE id = ?')
    .bind(sourceTagId).run();

  const markdown = `✅ Tags Merged

**Source Tag**: ${sourceTag.name} (ID: ${sourceTagId}) — DELETED
**Target Tag**: ${targetTag.name} (ID: ${targetTagId}) — KEPT
**Memories Moved**: ${memoriesAffected}

All memories previously tagged with "${sourceTag.name}" are now tagged with "${targetTag.name}".`;

  const structuredData = {
    success: true,
    data: {
      sourceTagId,
      sourceTagName: sourceTag.name,
      targetTagId,
      targetTagName: targetTag.name,
      memoriesAffected
    }
  };

  return createDualFormatResponse(markdown, structuredData);
}

/**
 * MCP Tool: Set Tag Parent
 * Sets or removes parent-child relationship between tags
 */
export async function handleSetTagParent(
  env: Env,
  args: { childTagId: number; parentTagId: number | null }
): Promise<any> {
  const { childTagId, parentTagId } = args;

  // Verify child tag exists
  const childTag = await env.DB.prepare('SELECT id, name FROM tags WHERE id = ?')
    .bind(childTagId).first<{ id: number; name: string }>();

  if (!childTag) {
    throw new Error(`Child tag with ID ${childTagId} not found`);
  }

  // Verify parent tag exists if specified
  let parentTag: { id: number; name: string } | null = null;
  if (parentTagId !== null) {
    parentTag = await env.DB.prepare('SELECT id, name FROM tags WHERE id = ?')
      .bind(parentTagId).first<{ id: number; name: string }>();

    if (!parentTag) {
      throw new Error(`Parent tag with ID ${parentTagId} not found`);
    }

    // Prevent circular reference
    if (childTagId === parentTagId) {
      throw new Error('A tag cannot be its own parent');
    }

    // Check if this would create a cycle (parent is descendant of child)
    const descendants = await getDescendants(env, childTagId);
    if (descendants.includes(parentTagId)) {
      throw new Error('Cannot set parent: would create circular hierarchy');
    }
  }

  // Remove existing parent relationship
  await env.DB.prepare('DELETE FROM tag_hierarchy WHERE child_id = ?')
    .bind(childTagId).run();

  // Add new parent if specified
  if (parentTagId !== null) {
    await env.DB.prepare('INSERT INTO tag_hierarchy (child_id, parent_id) VALUES (?, ?)')
      .bind(childTagId, parentTagId).run();
  }

  const markdown = parentTagId !== null
    ? `✅ Tag Hierarchy Updated

**Child Tag**: ${childTag.name} (ID: ${childTagId})
**New Parent**: ${parentTag!.name} (ID: ${parentTagId})

Hierarchy:
\`\`\`
${parentTag!.name}
└── ${childTag.name}
\`\`\``
    : `✅ Tag Hierarchy Updated

**Tag**: ${childTag.name} (ID: ${childTagId})
**Parent**: Removed (now a root tag)`;

  const structuredData = {
    success: true,
    data: {
      childTagId,
      childTagName: childTag.name,
      parentTagId,
      parentTagName: parentTag?.name || null
    }
  };

  return createDualFormatResponse(markdown, structuredData);
}

/**
 * Helper: Get all descendant tag IDs to prevent circular references
 */
async function getDescendants(env: Env, tagId: number): Promise<number[]> {
  const descendants: number[] = [];
  const queue = [tagId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await env.DB.prepare(
      'SELECT child_id FROM tag_hierarchy WHERE parent_id = ?'
    ).bind(currentId).all<{ child_id: number }>();

    for (const child of children.results || []) {
      if (!descendants.includes(child.child_id)) {
        descendants.push(child.child_id);
        queue.push(child.child_id);
      }
    }
  }

  return descendants;
}
