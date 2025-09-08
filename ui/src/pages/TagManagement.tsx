import React, { useState } from 'react';
import { TagTree } from '../components/TagTree';
import { TagSelector, SingleTagSelector } from '../components/TagSelector';
import { CreateTagForm } from '../components/CreateTagForm';
import { useTagHierarchy } from '../hooks/useTagHierarchy';

interface TagManagementState {
  activeTab: 'tree' | 'relationships' | 'bulk' | 'create';
  selectedParentId: number | null;
  selectedChildId: number | null;
  bulkChildIds: number[];
  operationResult: string | null;
  operationError: string | null;
}

/**
 * Comprehensive tag management page with hierarchy editor and bulk operations
 */
export function TagManagement() {
  const [state, setState] = useState<TagManagementState>({
    activeTab: 'tree',
    selectedParentId: null,
    selectedChildId: null,
    bulkChildIds: [],
    operationResult: null,
    operationError: null,
  });

  const {
    addParent,
    removeParent,
    findNode,
    loading,
    error,
    clearError
  } = useTagHierarchy();

  const handleTabChange = (tab: 'tree' | 'relationships' | 'bulk' | 'create') => {
    setState(prev => ({ ...prev, activeTab: tab }));
    clearOperationMessages();
  };

  const clearOperationMessages = () => {
    setState(prev => ({
      ...prev,
      operationResult: null,
      operationError: null
    }));
  };

  const showOperationResult = (message: string) => {
    setState(prev => ({ ...prev, operationResult: message, operationError: null }));
    setTimeout(() => {
      setState(prev => ({ ...prev, operationResult: null }));
    }, 5000);
  };

  const showOperationError = (message: string) => {
    setState(prev => ({ ...prev, operationError: message, operationResult: null }));
    setTimeout(() => {
      setState(prev => ({ ...prev, operationError: null }));
    }, 8000);
  };

  const handleAddParentRelationship = async () => {
    if (!state.selectedChildId || !state.selectedParentId) {
      showOperationError('Please select both child and parent tags');
      return;
    }

    if (state.selectedChildId === state.selectedParentId) {
      showOperationError('A tag cannot be its own parent');
      return;
    }

    try {
      await addParent(state.selectedChildId, state.selectedParentId);
      const childNode = findNode(state.selectedChildId);
      const parentNode = findNode(state.selectedParentId);
      showOperationResult(
        `Successfully added "${parentNode?.name}" as parent of "${childNode?.name}"`
      );
      setState(prev => ({
        ...prev,
        selectedChildId: null,
        selectedParentId: null
      }));
    } catch (err) {
      showOperationError(
        err instanceof Error ? err.message : 'Failed to add parent relationship'
      );
    }
  };

  const handleRemoveParentRelationship = async () => {
    if (!state.selectedChildId || !state.selectedParentId) {
      showOperationError('Please select both child and parent tags');
      return;
    }

    try {
      await removeParent(state.selectedChildId, state.selectedParentId);
      const childNode = findNode(state.selectedChildId);
      const parentNode = findNode(state.selectedParentId);
      showOperationResult(
        `Successfully removed "${parentNode?.name}" as parent of "${childNode?.name}"`
      );
      setState(prev => ({
        ...prev,
        selectedChildId: null,
        selectedParentId: null
      }));
    } catch (err) {
      showOperationError(
        err instanceof Error ? err.message : 'Failed to remove parent relationship'
      );
    }
  };

  const handleBulkAddParent = async () => {
    if (!state.selectedParentId || state.bulkChildIds.length === 0) {
      showOperationError('Please select a parent and at least one child tag');
      return;
    }

    if (state.bulkChildIds.includes(state.selectedParentId)) {
      showOperationError('A tag cannot be its own parent');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const childId of state.bulkChildIds) {
      try {
        await addParent(childId, state.selectedParentId);
        successCount++;
      } catch (err) {
        errorCount++;
        const childNode = findNode(childId);
        errors.push(`${childNode?.name || `Tag ${childId}`}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    if (errorCount === 0) {
      showOperationResult(
        `Successfully added parent to ${successCount} tags`
      );
    } else {
      showOperationError(
        `Bulk operation completed: ${successCount} successful, ${errorCount} failed.\n` +
        `Errors:\n${errors.join('\n')}`
      );
    }

    setState(prev => ({
      ...prev,
      selectedParentId: null,
      bulkChildIds: []
    }));
  };

  const renderTreeTab = () => (
    <div className="tab-content">
      <div className="tree-section">
        <TagTree />
      </div>
    </div>
  );

  const renderRelationshipsTab = () => (
    <div className="tab-content">
      <div className="relationships-section">
        <h3>Manage Parent-Child Relationships</h3>
        
        <div className="relationship-form">
          <div className="form-row">
            <div className="form-group">
              <label>Child Tag:</label>
              <SingleTagSelector
                selectedTag={state.selectedChildId || undefined}
                onSelectionChange={(id) => setState(prev => ({ ...prev, selectedChildId: id }))}
                placeholder="Select child tag..."
              />
            </div>
            
            <div className="form-group">
              <label>Parent Tag:</label>
              <SingleTagSelector
                selectedTag={state.selectedParentId || undefined}
                onSelectionChange={(id) => setState(prev => ({ ...prev, selectedParentId: id }))}
                placeholder="Select parent tag..."
              />
            </div>
          </div>

          <div className="relationship-actions">
            <button
              onClick={handleAddParentRelationship}
              disabled={!state.selectedChildId || !state.selectedParentId || loading}
              className="add-relationship-button"
            >
              Add Parent Relationship
            </button>
            
            <button
              onClick={handleRemoveParentRelationship}
              disabled={!state.selectedChildId || !state.selectedParentId || loading}
              className="remove-relationship-button"
            >
              Remove Parent Relationship
            </button>
          </div>
        </div>

        {state.selectedChildId && (
          <TagRelationshipViewer tagId={state.selectedChildId} />
        )}
      </div>
    </div>
  );

  const renderBulkTab = () => (
    <div className="tab-content">
      <div className="bulk-section">
        <h3>Bulk Parent Assignment</h3>
        
        <div className="bulk-form">
          <div className="form-group">
            <label>Parent Tag:</label>
            <SingleTagSelector
              selectedTag={state.selectedParentId || undefined}
              onSelectionChange={(id) => setState(prev => ({ ...prev, selectedParentId: id }))}
              placeholder="Select parent tag for bulk assignment..."
            />
          </div>

          <div className="form-group">
            <label>Child Tags:</label>
            <TagSelector
              selectedTags={state.bulkChildIds}
              onSelectionChange={(ids) => setState(prev => ({ ...prev, bulkChildIds: ids }))}
              placeholder="Select multiple child tags..."
              multiSelect={true}
            />
          </div>

          <div className="bulk-actions">
            <button
              onClick={handleBulkAddParent}
              disabled={!state.selectedParentId || state.bulkChildIds.length === 0 || loading}
              className="bulk-add-button"
            >
              Add Parent to {state.bulkChildIds.length} Tags
            </button>
            
            <button
              onClick={() => setState(prev => ({ ...prev, bulkChildIds: [], selectedParentId: null }))}
              className="clear-selection-button"
            >
              Clear Selection
            </button>
          </div>
        </div>

        <div className="bulk-warning">
          <p><strong>Warning:</strong> Bulk operations cannot be easily undone. Please verify your selection before proceeding.</p>
          <p>This will attempt to add the selected parent to all selected child tags. Individual failures will be reported.</p>
        </div>
      </div>
    </div>
  );

  const renderCreateTab = () => (
    <div className="tab-content">
      <div className="create-section">
        <CreateTagForm
          onSuccess={showOperationResult}
          onError={showOperationError}
        />
      </div>
    </div>
  );

  return (
    <div className="tag-management-page">
      <div className="page-header">
        <h1>Tag Hierarchy Management</h1>
        <p>Manage tag relationships, view hierarchies, and perform bulk operations</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${state.activeTab === 'tree' ? 'active' : ''}`}
          onClick={() => handleTabChange('tree')}
        >
          Tree View
        </button>
        <button
          className={`tab ${state.activeTab === 'create' ? 'active' : ''}`}
          onClick={() => handleTabChange('create')}
        >
          Create Tags
        </button>
        <button
          className={`tab ${state.activeTab === 'relationships' ? 'active' : ''}`}
          onClick={() => handleTabChange('relationships')}
        >
          Relationships
        </button>
        <button
          className={`tab ${state.activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => handleTabChange('bulk')}
        >
          Bulk Operations
        </button>
      </div>

      {/* Operation Messages */}
      {state.operationResult && (
        <div className="operation-message success">
          {state.operationResult}
        </div>
      )}
      
      {state.operationError && (
        <div className="operation-message error">
          {state.operationError}
        </div>
      )}

      {/* Global Error */}
      {error && (
        <div className="global-error">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      <div className="tab-container">
        {state.activeTab === 'tree' && renderTreeTab()}
        {state.activeTab === 'create' && renderCreateTab()}
        {state.activeTab === 'relationships' && renderRelationshipsTab()}
        {state.activeTab === 'bulk' && renderBulkTab()}
      </div>
    </div>
  );
}

/**
 * Component to display tag relationships (ancestors/descendants)
 */
interface TagRelationshipViewerProps {
  tagId: number;
}

export function TagRelationshipViewer({ tagId }: TagRelationshipViewerProps) {
  const [ancestors, setAncestors] = useState<any[]>([]);
  const [descendants, setDescendants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getAncestors, getDescendants, findNode } = useTagHierarchy();
  
  const tagNode = findNode(tagId);

  React.useEffect(() => {
    async function loadRelationships() {
      setLoading(true);
      setError(null);

      try {
        const [ancestorData, descendantData] = await Promise.all([
          getAncestors(tagId),
          getDescendants(tagId)
        ]);
        
        setAncestors(ancestorData);
        setDescendants(descendantData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load relationships');
      } finally {
        setLoading(false);
      }
    }

    loadRelationships();
  }, [tagId, getAncestors, getDescendants]);

  if (loading) {
    return (
      <div className="relationship-viewer loading">
        <div className="mini-spinner"></div>
        <span>Loading relationships...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relationship-viewer error">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="relationship-viewer">
      <h4>Relationships for "{tagNode?.name}" (ID: {tagId})</h4>
      
      <div className="relationships-grid">
        <div className="relationship-column">
          <h5>Ancestors ({ancestors.length})</h5>
          {ancestors.length === 0 ? (
            <p className="no-relationships">No ancestor tags</p>
          ) : (
            <ul className="relationship-list">
              {ancestors.map(ancestor => (
                <li key={ancestor.id}>
                  {ancestor.name} (ID: {ancestor.id})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relationship-column">
          <h5>Descendants ({descendants.length})</h5>
          {descendants.length === 0 ? (
            <p className="no-relationships">No descendant tags</p>
          ) : (
            <ul className="relationship-list">
              {descendants.map(descendant => (
                <li key={descendant.id}>
                  {descendant.name} (ID: {descendant.id})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}