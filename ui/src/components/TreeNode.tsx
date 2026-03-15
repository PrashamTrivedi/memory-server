import React, { useState, useEffect, useRef } from 'react';
import { TreeNodeProps } from '../types/tags';

interface TreeNodeState {
  showMenu: boolean;
  showAddParentModal: boolean;
  showRemoveParentModal: boolean;
}

export function TreeNode({
  node,
  onToggleExpanded,
  onAddParent,
  onRemoveParent,
  onAddChild,
  selectedNodeId,
  onNodeSelect,
  level,
}: TreeNodeProps) {
  const [state, setState] = useState<TreeNodeState>({
    showMenu: false,
    showAddParentModal: false,
    showRemoveParentModal: false,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = node.expanded || false;

  // Close context menu on outside click
  useEffect(() => {
    if (!state.showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setState(prev => ({ ...prev, showMenu: false }));
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [state.showMenu]);

  const handleToggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpanded(node.id);
    }
  };

  const handleNodeClick = () => {
    onNodeSelect(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, showMenu: !prev.showMenu }));
  };

  const handleMenuAction = (action: string) => {
    setState(prev => ({ ...prev, showMenu: false }));
    switch (action) {
      case 'add-parent':
        setState(prev => ({ ...prev, showAddParentModal: true }));
        break;
      case 'remove-parent':
        setState(prev => ({ ...prev, showRemoveParentModal: true }));
        break;
      case 'add-child':
        onAddChild(node.id);
        break;
    }
  };

  const closeModals = () => {
    setState(prev => ({
      ...prev,
      showAddParentModal: false,
      showRemoveParentModal: false,
    }));
  };

  return (
    <div>
      {/* Node row */}
      <div
        className={`group relative flex items-center gap-1.5 px-2 py-[5px] rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-primary-50 dark:bg-primary-900/20'
            : 'hover:bg-slate-100 dark:hover:bg-slate-700/40'
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
      >
        {/* Left accent bar for selected */}
        {isSelected && (
          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-primary-500" />
        )}

        {/* Expand/collapse chevron */}
        <button
          className={`w-5 h-5 flex items-center justify-center rounded shrink-0 transition-colors ${
            hasChildren
              ? 'text-slate-400 hover:text-primary-600 hover:bg-slate-200 dark:hover:bg-slate-600'
              : 'text-slate-300 dark:text-slate-600'
          }`}
          onClick={handleToggleExpanded}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
            >
              <path d="M9 18l6-6-6-6"/>
            </svg>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          )}
        </button>

        {/* Tag icon */}
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`shrink-0 transition-colors ${
            isSelected ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-primary-400'
          }`}
        >
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1" fill="currentColor" stroke="none"/>
        </svg>

        {/* Name */}
        <span className={`flex-1 text-[13px] truncate transition-colors ${
          isSelected
            ? 'font-semibold text-primary-800 dark:text-primary-300'
            : 'font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100'
        }`}>
          {node.name}
        </span>

        {/* Parent count indicator */}
        {node.parents.length > 0 && (
          <span
            className="shrink-0 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/50"
            title={`${node.parents.length} parent(s)`}
          >
            {node.parents.length}p
          </span>
        )}

        {/* Children count */}
        {hasChildren && (
          <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
            {node.children.length}
          </span>
        )}

        {/* ID badge */}
        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md font-mono tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
          #{node.id}
        </span>

        {/* Context menu trigger */}
        <button
          onClick={(e) => { e.stopPropagation(); setState(prev => ({ ...prev, showMenu: !prev.showMenu })); }}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>

        {/* Context menu dropdown */}
        {state.showMenu && (
          <div
            ref={menuRef}
            className="absolute top-full right-2 z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden min-w-[140px] animate-scale-in"
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              onClick={() => handleMenuAction('add-parent')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Add Parent
            </button>
            {node.parents.length > 0 && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                onClick={() => handleMenuAction('remove-parent')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
                Remove Parent
              </button>
            )}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              onClick={() => handleMenuAction('add-child')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Add Child
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {state.showAddParentModal && (
        <AddParentModal
          childId={node.id}
          childName={node.name}
          onAddParent={onAddParent}
          onClose={closeModals}
        />
      )}
      {state.showRemoveParentModal && (
        <RemoveParentModal
          childId={node.id}
          childName={node.name}
          parents={node.parents}
          onRemoveParent={onRemoveParent}
          onClose={closeModals}
        />
      )}

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="ml-3 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onToggleExpanded={onToggleExpanded}
              onAddParent={onAddParent}
              onRemoveParent={onRemoveParent}
              onAddChild={onAddChild}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Modals ─── */

interface AddParentModalProps {
  childId: number;
  childName: string;
  onAddParent: (childId: number, parentId?: number) => void;
  onClose: () => void;
}

function AddParentModal({ childId, childName, onAddParent, onClose }: AddParentModalProps) {
  const [parentId, setParentId] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parentIdNum = parseInt(parentId);
    if (isNaN(parentIdNum) || parentIdNum <= 0) {
      setError('Please enter a valid parent tag ID');
      return;
    }
    if (parentIdNum === childId) {
      setError('A tag cannot be its own parent');
      return;
    }
    try {
      onAddParent(childId, parentIdNum);
      onClose();
    } catch (err) {
      setError('Failed to add parent relationship');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 max-w-md w-[90%] overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            Add Parent to "<span className="text-primary-600 dark:text-primary-400">{childName}</span>"
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="parentId" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">Parent Tag ID</label>
            <input
              type="number"
              id="parentId"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="Enter parent tag ID"
              min="1"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm rounded-xl bg-primary-500 text-white hover:bg-primary-600 font-semibold shadow-sm transition-colors">
              Add Parent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RemoveParentModalProps {
  childId: number;
  childName: string;
  parents: Array<{ id: number; name: string }>;
  onRemoveParent: (childId: number, parentId: number) => void;
  onClose: () => void;
}

function RemoveParentModal({ childId, childName, parents, onRemoveParent, onClose }: RemoveParentModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);

  const handleRemove = () => {
    if (selectedParentId !== null) {
      onRemoveParent(childId, selectedParentId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 max-w-md w-[90%] overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            Remove Parent from "<span className="text-primary-600 dark:text-primary-400">{childName}</span>"
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Select a parent to remove:</p>

          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {parents.map((parent) => (
              <label
                key={parent.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  selectedParentId === parent.id
                    ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
              >
                <input
                  type="radio"
                  name="parent"
                  value={parent.id}
                  checked={selectedParentId === parent.id}
                  onChange={() => setSelectedParentId(parent.id)}
                  className="accent-primary-500 w-4 h-4"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{parent.name}</span>
                <span className="text-[10px] text-slate-400 font-mono ml-auto">#{parent.id}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors">
              Cancel
            </button>
            <button
              onClick={handleRemove}
              disabled={selectedParentId === null}
              className="px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove Parent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
