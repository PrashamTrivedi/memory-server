import { useState } from 'react';
import { UseTagHierarchyReturn } from '../hooks/useTagHierarchy';
import { TagTreeNode } from '../types/tags';

interface SidebarProps {
  tagHierarchy: UseTagHierarchyReturn;
  selectedTags: string[];
  onTagSelect: (tagName: string) => void;
  onClearTags: () => void;
}

export function Sidebar({ tagHierarchy, selectedTags, onTagSelect, onClearTags }: SidebarProps) {
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

  const filteredTree = filterNodes(tree, searchFilter);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tags</h3>
          <div className="flex items-center gap-1">
            {selectedTags.length > 0 && (
              <button
                onClick={onClearTags}
                className="text-xs text-primary-500 hover:text-primary-600 px-1.5 py-0.5 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"
              >
                Clear
              </button>
            )}
            <button
              onClick={refreshTree}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
              title="Refresh tags"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
          </div>
        </div>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter tags..."
          className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {/* Active filters */}
      {selectedTags.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-1">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
            >
              {tag}
              <button
                onClick={(e) => { e.stopPropagation(); onTagSelect(tag); }}
                className="hover:text-primary-900 dark:hover:text-primary-100"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="px-4 py-3 text-xs text-red-500">{error}</div>
        ) : filteredTree.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            {searchFilter ? 'No matching tags' : 'No tags yet'}
          </div>
        ) : (
          filteredTree.map(node => (
            <SidebarTreeNode
              key={node.id}
              node={node}
              level={0}
              expandedNodes={expandedNodes}
              selectedTags={selectedTags}
              onToggle={toggleNodeExpanded}
              onSelect={onTagSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface SidebarTreeNodeProps {
  node: TagTreeNode;
  level: number;
  expandedNodes: Set<number>;
  selectedTags: string[];
  onToggle: (nodeId: number) => void;
  onSelect: (tagName: string) => void;
}

function SidebarTreeNode({ node, level, expandedNodes, selectedTags, onToggle, onSelect }: SidebarTreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedTags.includes(node.name);

  return (
    <>
      <button
        onClick={() => onSelect(node.name)}
        className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-sm transition-colors group ${
          isSelected
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 shrink-0"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            >
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="truncate flex-1">{node.name}</span>
        {hasChildren && (
          <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
            {countDescendantTags(node)}
          </span>
        )}
      </button>
      {isExpanded && hasChildren && (
        node.children.map(child => (
          <SidebarTreeNode
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
