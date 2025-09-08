// Tag hierarchy data structures
export interface Tag {
  id: number;
  name: string;
  parents?: Tag[];
  children?: Tag[];
  ancestors?: Tag[];
  descendants?: Tag[];
}

export interface TagTreeNode {
  id: number;
  name: string;
  children: TagTreeNode[];
  parents: TagTreeNode[];
  depth?: number;
  expanded?: boolean;
  path?: string[];
}

// API request/response types
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

export interface ParentsResponse {
  success: boolean;
  data?: {
    tag_id: number;
    parents: Tag[];
  };
  error?: string;
}

export interface ChildrenResponse {
  success: boolean;
  data?: {
    tag_id: number;
    children: Tag[];
  };
  error?: string;
}

// New API request/response types for creating tags with parent relationships
export interface CreateTagsWithParentRequest {
  child_tag_name: string;
  parent_tag_name: string;
}

export interface CreateTagsWithParentResponse {
  success: boolean;
  data?: {
    child_tag: Tag;
    parent_tag: Tag;
    relationship_created: boolean;
  };
  error?: string;
  message?: string;
}

// UI-specific types
export interface TreeNodeProps {
  node: TagTreeNode;
  onToggleExpanded: (nodeId: number) => void;
  onAddParent: (childId: number) => void;
  onRemoveParent: (childId: number, parentId: number) => void;
  onAddChild: (parentId: number) => void;
  selectedNodeId?: number;
  onNodeSelect: (nodeId: number) => void;
  level: number;
}

export interface TagPath {
  id: number;
  name: string;
}

export interface FlatTag extends Tag {
  depth: number;
  path: TagPath[];
  hasChildren: boolean;
  isExpanded?: boolean;
}

// API Error types
export interface ApiError {
  message: string;
  statusCode?: number;
}