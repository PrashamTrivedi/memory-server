import { useState, useEffect, useCallback, useMemo } from 'react';
import { TagHierarchyApi, TagHierarchyApiError } from '../api/tagHierarchy';
import { Tag, TagTreeNode, FlatTag, TagPath } from '../types/tags';

export interface UseTagHierarchyState {
  tree: TagTreeNode[];
  loading: boolean;
  error: string | null;
  expandedNodes: Set<number>;
  selectedNodeId: number | null;
}

export interface UseTagHierarchyActions {
  refreshTree: () => Promise<void>;
  toggleNodeExpanded: (nodeId: number) => void;
  expandNode: (nodeId: number) => void;
  collapseNode: (nodeId: number) => void;
  selectNode: (nodeId: number) => void;
  addParent: (childId: number, parentId: number) => Promise<void>;
  removeParent: (childId: number, parentId: number) => Promise<void>;
  getAncestors: (tagId: number) => Promise<Tag[]>;
  getDescendants: (tagId: number) => Promise<Tag[]>;
  clearError: () => void;
}

export interface UseTagHierarchyReturn extends UseTagHierarchyState, UseTagHierarchyActions {
  flatTree: FlatTag[];
  getNodePath: (nodeId: number) => TagPath[];
  findNode: (nodeId: number) => TagTreeNode | null;
}

/**
 * Custom hook for managing tag hierarchy state and operations
 */
export function useTagHierarchy(): UseTagHierarchyReturn {
  const [tree, setTree] = useState<TagTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  /**
   * Load the tag hierarchy tree from the API
   */
  const refreshTree = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const treeData = await TagHierarchyApi.getTagTree();
      setTree(treeData);
    } catch (err) {
      const errorMessage = err instanceof TagHierarchyApiError 
        ? err.message 
        : 'Failed to load tag hierarchy';
      setError(errorMessage);
      console.error('Error loading tag tree:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  /**
   * Toggle node expansion state
   */
  const toggleNodeExpanded = useCallback((nodeId: number) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  /**
   * Expand a node
   */
  const expandNode = useCallback((nodeId: number) => {
    setExpandedNodes(prev => new Set([...prev, nodeId]));
  }, []);

  /**
   * Collapse a node
   */
  const collapseNode = useCallback((nodeId: number) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  }, []);

  /**
   * Select a node
   */
  const selectNode = useCallback((nodeId: number) => {
    setSelectedNodeId(nodeId);
  }, []);

  /**
   * Add a parent relationship
   */
  const addParent = useCallback(async (childId: number, parentId: number) => {
    try {
      setError(null);
      await TagHierarchyApi.addParent(childId, parentId);
      await refreshTree(); // Refresh to show changes
    } catch (err) {
      const errorMessage = err instanceof TagHierarchyApiError 
        ? err.message 
        : 'Failed to add parent relationship';
      setError(errorMessage);
      throw err;
    }
  }, [refreshTree]);

  /**
   * Remove a parent relationship
   */
  const removeParent = useCallback(async (childId: number, parentId: number) => {
    try {
      setError(null);
      await TagHierarchyApi.removeParent(childId, parentId);
      await refreshTree(); // Refresh to show changes
    } catch (err) {
      const errorMessage = err instanceof TagHierarchyApiError 
        ? err.message 
        : 'Failed to remove parent relationship';
      setError(errorMessage);
      throw err;
    }
  }, [refreshTree]);

  /**
   * Get ancestors for a tag
   */
  const getAncestors = useCallback(async (tagId: number): Promise<Tag[]> => {
    try {
      setError(null);
      return await TagHierarchyApi.getAncestors(tagId);
    } catch (err) {
      const errorMessage = err instanceof TagHierarchyApiError 
        ? err.message 
        : 'Failed to get ancestors';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Get descendants for a tag
   */
  const getDescendants = useCallback(async (tagId: number): Promise<Tag[]> => {
    try {
      setError(null);
      return await TagHierarchyApi.getDescendants(tagId);
    } catch (err) {
      const errorMessage = err instanceof TagHierarchyApiError 
        ? err.message 
        : 'Failed to get descendants';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Find a node in the tree by ID
   */
  const findNode = useCallback((nodeId: number): TagTreeNode | null => {
    function searchNode(nodes: TagTreeNode[]): TagTreeNode | null {
      for (const node of nodes) {
        if (node.id === nodeId) {
          return node;
        }
        const found = searchNode(node.children);
        if (found) {
          return found;
        }
      }
      return null;
    }
    return searchNode(tree);
  }, [tree]);

  /**
   * Get the path to a node (list of parent names)
   */
  const getNodePath = useCallback((nodeId: number): TagPath[] => {
    function buildPath(nodes: TagTreeNode[], targetId: number, currentPath: TagPath[]): TagPath[] | null {
      for (const node of nodes) {
        const newPath = [...currentPath, { id: node.id, name: node.name }];
        
        if (node.id === targetId) {
          return newPath;
        }
        
        const foundPath = buildPath(node.children, targetId, newPath);
        if (foundPath) {
          return foundPath;
        }
      }
      return null;
    }

    const path = buildPath(tree, nodeId, []);
    return path || [];
  }, [tree]);

  /**
   * Flatten tree for easier rendering and manipulation
   */
  const flatTree = useMemo((): FlatTag[] => {
    function flattenNode(node: TagTreeNode, depth: number, path: TagPath[]): FlatTag[] {
      const currentPath = [...path, { id: node.id, name: node.name }];
      const isExpanded = expandedNodes.has(node.id);
      
      const flatNode: FlatTag = {
        id: node.id,
        name: node.name,
        depth,
        path: currentPath,
        hasChildren: node.children.length > 0,
        isExpanded,
      };

      const result = [flatNode];

      if (isExpanded && node.children.length > 0) {
        for (const child of node.children) {
          result.push(...flattenNode(child, depth + 1, currentPath));
        }
      }

      return result;
    }

    const flattened: FlatTag[] = [];
    for (const rootNode of tree) {
      flattened.push(...flattenNode(rootNode, 0, []));
    }
    return flattened;
  }, [tree, expandedNodes]);

  return {
    // State
    tree,
    loading,
    error,
    expandedNodes,
    selectedNodeId,
    flatTree,
    
    // Actions
    refreshTree,
    toggleNodeExpanded,
    expandNode,
    collapseNode,
    selectNode,
    addParent,
    removeParent,
    getAncestors,
    getDescendants,
    clearError,
    
    // Utilities
    getNodePath,
    findNode,
  };
}