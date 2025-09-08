// Memory data types
export interface Memory {
  id: string;
  name: string;
  content: string;
  url?: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface CreateMemoryRequest {
  name: string;
  content: string;
  url?: string;
  tags?: string[];
}

export interface UpdateMemoryRequest {
  name?: string;
  content?: string;
  url?: string;
  tags?: string[];
}

export interface FindMemoriesRequest {
  query?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// MCP Tool definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

// Database row types
export interface MemoryRow {
  id: string;
  name: string;
  content: string;
  url: string | null;
  created_at: number;
  updated_at: number;
}

export interface TagRow {
  id: number;
  name: string;
}

export interface MemoryTagRow {
  memory_id: string;
  tag_id: number;
}

// Tag Hierarchy types
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

export interface TagTreeNode {
  id: number;
  name: string;
  children: TagTreeNode[];
  parents: TagTreeNode[];
}

// New request types for tag creation with hierarchy
export interface CreateTagsWithRelationshipRequest {
  child_tag_name: string;
  parent_tag_name: string;
}

export interface CreateTagsWithRelationshipResponse {
  success: boolean;
  data?: {
    child_tag: Tag;
    parent_tag: Tag;
    hierarchy: TagHierarchy;
    created_child: boolean;
    created_parent: boolean;
  };
  error?: string;
}

// Existing tag hierarchy response types
export interface AddParentRequest {
  parent_tag_id: number;
}

export interface TagHierarchyResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface AncestorsResponse {
  tag_id: number;
  ancestors: Tag[];
}

export interface DescendantsResponse {
  tag_id: number;
  descendants: Tag[];
}

export interface TagTreeResponse {
  tree: TagTreeNode[];
}