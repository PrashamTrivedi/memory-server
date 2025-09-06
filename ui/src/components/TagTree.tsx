import React, { useState } from 'react';
import { TreeNode } from './TreeNode';
import { useTagHierarchy } from '../hooks/useTagHierarchy';
import { TagTreeNode } from '../types/tags';

/**
 * Main tag tree component with collapsible hierarchy
 */
export function TagTree() {
  const {
    tree,
    loading,
    error,
    selectedNodeId,
    toggleNodeExpanded,
    selectNode,
    addParent,
    removeParent,
    refreshTree,
    clearError,
    expandedNodes
  } = useTagHierarchy();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Add expanded property to tree nodes for rendering
  const enrichedTree = React.useMemo(() => {
    function enrichNode(node: TagTreeNode): TagTreeNode {
      return {
        ...node,
        expanded: expandedNodes.has(node.id),
        children: node.children.map(enrichNode)
      };
    }
    return tree.map(enrichNode);
  }, [tree, expandedNodes]);

  // Filter tree based on search term
  const filteredTree = React.useMemo(() => {
    if (!searchTerm.trim()) return enrichedTree;

    function filterNodes(nodes: TagTreeNode[]): TagTreeNode[] {
      return nodes.filter(node => {
        const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase());
        const hasMatchingChildren = filterNodes(node.children).length > 0;
        
        if (matchesSearch || hasMatchingChildren) {
          return {
            ...node,
            children: hasMatchingChildren ? filterNodes(node.children) : node.children
          };
        }
        return false;
      }).filter(Boolean) as TagTreeNode[];
    }

    return filterNodes(enrichedTree);
  }, [enrichedTree, searchTerm]);

  const handleAddParent = async (childId: number, parentId?: number) => {
    if (parentId === undefined) return;
    
    try {
      await addParent(childId, parentId);
    } catch (err) {
      // Error is handled by the hook
      console.error('Failed to add parent:', err);
    }
  };

  const handleRemoveParent = async (childId: number, parentId: number) => {
    try {
      await removeParent(childId, parentId);
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handleAddChild = (parentId: number) => {
    // This would trigger a modal or form to create a new tag with this parent
    console.log('Add child to parent:', parentId);
    setShowCreateForm(true);
  };

  const handleExpandAll = () => {
    function getAllNodeIds(nodes: TagTreeNode[]): number[] {
      const ids: number[] = [];
      for (const node of nodes) {
        ids.push(node.id);
        ids.push(...getAllNodeIds(node.children));
      }
      return ids;
    }

    const allIds = getAllNodeIds(tree);
    allIds.forEach(id => {
      if (!expandedNodes.has(id)) {
        toggleNodeExpanded(id);
      }
    });
  };

  const handleCollapseAll = () => {
    expandedNodes.forEach(id => {
      toggleNodeExpanded(id);
    });
  };

  if (loading) {
    return (
      <div className="tag-tree-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading tag hierarchy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tag-tree-container">
      <div className="tag-tree-header">
        <h2>Tag Hierarchy</h2>
        
        <div className="toolbar">
          <div className="search-group">
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="clear-search"
              >
                ×
              </button>
            )}
          </div>

          <div className="action-buttons">
            <button onClick={handleExpandAll} className="expand-all-button">
              Expand All
            </button>
            <button onClick={handleCollapseAll} className="collapse-all-button">
              Collapse All
            </button>
            <button onClick={refreshTree} className="refresh-button">
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <span className="error-text">{error}</span>
            <button onClick={clearError} className="error-close">×</button>
          </div>
        )}
      </div>

      <div className="tag-tree-content">
        {filteredTree.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? (
              <p>No tags match your search "{searchTerm}"</p>
            ) : (
              <p>No tags found. Create some tags to see the hierarchy.</p>
            )}
          </div>
        ) : (
          <div className="tree-nodes">
            {filteredTree.map((rootNode) => (
              <TreeNode
                key={rootNode.id}
                node={rootNode}
                onToggleExpanded={toggleNodeExpanded}
                onAddParent={handleAddParent}
                onRemoveParent={handleRemoveParent}
                onAddChild={handleAddChild}
                selectedNodeId={selectedNodeId || undefined}
                onNodeSelect={selectNode}
                level={0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tree Stats */}
      <div className="tree-stats">
        <span>Total nodes: {tree.reduce((acc, node) => acc + countNodes(node), 0)}</span>
        <span>Expanded: {expandedNodes.size}</span>
        {searchTerm && (
          <span>Filtered: {filteredTree.reduce((acc, node) => acc + countNodes(node), 0)}</span>
        )}
      </div>

      {/* Create Form Modal (placeholder) */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Tag</h3>
              <button className="close-button" onClick={() => setShowCreateForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Tag creation form would go here.</p>
              <p>This would integrate with the main tag management system.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to count total nodes in a tree
 */
function countNodes(node: TagTreeNode): number {
  return 1 + node.children.reduce((acc, child) => acc + countNodes(child), 0);
}