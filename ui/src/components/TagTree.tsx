import React, { useState } from 'react';
import { TreeNode } from './TreeNode';
import { useTagHierarchy } from '../hooks/useTagHierarchy';
import { TagTreeNode } from '../types/tags';

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
      console.error('Failed to add parent:', err);
    }
  };

  const handleRemoveParent = async (childId: number, parentId: number) => {
    try {
      await removeParent(childId, parentId);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleAddChild = (parentId: number) => {
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
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading tag hierarchy...</p>
      </div>
    );
  }

  const totalNodes = tree.reduce((acc, node) => acc + countNodes(node), 0);
  const filteredCount = filteredTree.reduce((acc, node) => acc + countNodes(node), 0);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Header toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExpandAll}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Expand all
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Collapse all
            </button>
            <button
              onClick={refreshTree}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-600 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              title="Refresh"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2.5 flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
            <span>{error}</span>
            <button onClick={clearError} className="ml-2 text-red-400 hover:text-red-600 dark:hover:text-red-200 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}
      </div>

      {/* Tree content */}
      <div className="max-h-[520px] overflow-y-auto px-2 py-2">
        {filteredTree.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            {searchTerm
              ? <>No tags match "<span className="font-medium text-slate-500">{searchTerm}</span>"</>
              : 'No tags found. Create some tags to see the hierarchy.'}
          </div>
        ) : (
          <div className="space-y-px">
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

      {/* Stats footer */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 font-medium tabular-nums">
        <span>{totalNodes} tags</span>
        <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
        <span>{expandedNodes.size} expanded</span>
        {searchTerm && (
          <>
            <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
            <span>{filteredCount} matching</span>
          </>
        )}
      </div>

      {/* Create form placeholder modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 max-w-md w-[90%] overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Create New Tag</h3>
              <button onClick={() => setShowCreateForm(false)} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5 text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <p>Tag creation form would go here.</p>
              <p>This would integrate with the main tag management system.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function countNodes(node: TagTreeNode): number {
  return 1 + node.children.reduce((acc, child) => acc + countNodes(child), 0);
}
