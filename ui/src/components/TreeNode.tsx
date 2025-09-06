import React, { useState } from 'react';
import { TreeNodeProps } from '../types/tags';

interface TreeNodeState {
  showMenu: boolean;
  showAddParentModal: boolean;
  showRemoveParentModal: boolean;
}

/**
 * Individual tree node component with expand/collapse and context menu
 */
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

  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = node.expanded || false;

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
    <div className="tree-node-container">
      <div
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse Button */}
        <button
          className={`expand-button ${hasChildren ? 'has-children' : 'no-children'}`}
          onClick={handleToggleExpanded}
          disabled={!hasChildren}
        >
          {hasChildren ? (isExpanded ? '−' : '+') : '○'}
        </button>

        {/* Node Name */}
        <span className="node-name">{node.name}</span>

        {/* Node ID Badge */}
        <span className="node-id">{node.id}</span>

        {/* Parent/Child indicators */}
        {node.parents.length > 0 && (
          <span className="parent-indicator" title={`${node.parents.length} parent(s)`}>
            ↑{node.parents.length}
          </span>
        )}

        {/* Context Menu */}
        {state.showMenu && (
          <div className="context-menu">
            <button
              className="menu-item"
              onClick={() => handleMenuAction('add-parent')}
            >
              Add Parent
            </button>
            {node.parents.length > 0 && (
              <button
                className="menu-item"
                onClick={() => handleMenuAction('remove-parent')}
              >
                Remove Parent
              </button>
            )}
            <button
              className="menu-item"
              onClick={() => handleMenuAction('add-child')}
            >
              Add Child
            </button>
          </div>
        )}
      </div>

      {/* Add Parent Modal */}
      {state.showAddParentModal && (
        <AddParentModal
          childId={node.id}
          childName={node.name}
          onAddParent={onAddParent}
          onClose={closeModals}
        />
      )}

      {/* Remove Parent Modal */}
      {state.showRemoveParentModal && (
        <RemoveParentModal
          childId={node.id}
          childName={node.name}
          parents={node.parents}
          onRemoveParent={onRemoveParent}
          onClose={closeModals}
        />
      )}

      {/* Render Children */}
      {isExpanded && hasChildren && (
        <div className="children">
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

/**
 * Modal for adding a parent relationship
 */
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Parent to "{childName}"</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="parentId">Parent Tag ID:</label>
            <input
              type="number"
              id="parentId"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="Enter parent tag ID"
              min="1"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="confirm-button">
              Add Parent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal for removing a parent relationship
 */
interface RemoveParentModalProps {
  childId: number;
  childName: string;
  parents: Array<{ id: number; name: string }>;
  onRemoveParent: (childId: number, parentId: number) => void;
  onClose: () => void;
}

function RemoveParentModal({ 
  childId, 
  childName, 
  parents, 
  onRemoveParent, 
  onClose 
}: RemoveParentModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);

  const handleRemove = () => {
    if (selectedParentId !== null) {
      onRemoveParent(childId, selectedParentId);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Remove Parent from "{childName}"</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p>Select a parent to remove:</p>
          
          <div className="parent-list">
            {parents.map((parent) => (
              <label key={parent.id} className="parent-option">
                <input
                  type="radio"
                  name="parent"
                  value={parent.id}
                  onChange={() => setSelectedParentId(parent.id)}
                />
                <span>{parent.name} (ID: {parent.id})</span>
              </label>
            ))}
          </div>

          <div className="modal-actions">
            <button onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button 
              onClick={handleRemove} 
              className="danger-button"
              disabled={selectedParentId === null}
            >
              Remove Parent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}