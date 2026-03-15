import { useState } from 'react';
import { UseTagHierarchyReturn } from '../hooks/useTagHierarchy';
import { TagTreeNode } from '../types/tags';

interface TagSidebarProps {
  tagHierarchy: UseTagHierarchyReturn;
  selectedTags: string[];
  onTagSelect: (tagName: string) => void;
  onClearTags: () => void;
  usedTags: Set<string>;
}

export function TagSidebar({ tagHierarchy, selectedTags, onTagSelect, onClearTags, usedTags }: TagSidebarProps) {
  const { tree, loading, error, expandedNodes, toggleNodeExpanded, refreshTree } = tagHierarchy;
  const [searchFilter, setSearchFilter] = useState('');

  const filterNodes = (nodes: TagTreeNode[], filter: string): TagTreeNode[] => {
    if (!filter) return nodes;
    const lower = filter.toLowerCase();
    return nodes.reduce<TagTreeNode[]>((acc, node) => {
      const nameMatch = node.name.toLowerCase().includes(lower);
      const filteredChildren = filterNodes(node.children, filter);
      if (nameMatch || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  };

  const pruneEmpty = (nodes: TagTreeNode[]): TagTreeNode[] => {
    return nodes.reduce<TagTreeNode[]>((acc, node) => {
      const prunedChildren = pruneEmpty(node.children);
      if (usedTags.has(node.name) || prunedChildren.length > 0) {
        acc.push({ ...node, children: prunedChildren });
      }
      return acc;
    }, []);
  };

  const filteredTree = pruneEmpty(filterNodes(tree, searchFilter));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">Tags</h3>
          <div className="flex items-center gap-1">
            {selectedTags.length > 0 && (
              <button
                onClick={onClearTags}
                className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 px-1.5 py-0.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={refreshTree}
              className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
              title="Refresh tags"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
          </div>
        </div>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter tags..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all"
          />
        </div>
      </div>

      {/* Active tag filters */}
      {selectedTags.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/50"
            >
              {tag}
              <button
                onClick={(e) => { e.stopPropagation(); onTagSelect(tag); }}
                className="hover:text-primary-900 dark:hover:text-primary-100 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-slate-200 dark:bg-slate-700 mx-3" />

      {/* Tag tree */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="px-3 py-3 text-xs text-red-500">{error}</div>
        ) : filteredTree.length === 0 ? (
          <div className="px-3 py-10 text-center text-xs text-slate-400">
            {searchFilter ? 'No matching tags' : 'No tags yet'}
          </div>
        ) : (
          <div className="px-1.5">
            {filteredTree.map(node => (
              <TagTreeNodeItem
                key={node.id}
                node={node}
                level={0}
                expandedNodes={expandedNodes}
                selectedTags={selectedTags}
                onToggle={toggleNodeExpanded}
                onSelect={onTagSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TagTreeNodeItemProps {
  node: TagTreeNode;
  level: number;
  expandedNodes: Set<number>;
  selectedTags: string[];
  onToggle: (nodeId: number) => void;
  onSelect: (tagName: string) => void;
}

function TagTreeNodeItem({ node, level, expandedNodes, selectedTags, onToggle, onSelect }: TagTreeNodeItemProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedTags.includes(node.name);

  return (
    <>
      <button
        onClick={() => onSelect(node.name)}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-left text-[13px] transition-all group ${
          isSelected
            ? 'bg-primary-50 dark:bg-primary-900/25 text-primary-700 dark:text-primary-300 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
        style={{ paddingLeft: `${10 + level * 16}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 shrink-0 transition-colors"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            >
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
        <span className="truncate flex-1">{node.name}</span>
        {hasChildren && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums font-medium">
            {countDescendantTags(node)}
          </span>
        )}
      </button>
      {isExpanded && hasChildren && (
        node.children.map(child => (
          <TagTreeNodeItem
            key={child.id}
            node={child}
            level={level + 1}
            expandedNodes={expandedNodes}
            selectedTags={selectedTags}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))
      )}
    </>
  );
}

function countDescendantTags(node: TagTreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendantTags(child);
  }
  return count;
}
