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
    <div>
      <TagTree />
    </div>
  );

  const renderRelationshipsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6">
        <h3
          className="text-base font-bold text-slate-900 dark:text-slate-100 mb-5 tracking-tight"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          Manage Parent-Child Relationships
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Child Tag
            </label>
            <SingleTagSelector
              selectedTag={state.selectedChildId || undefined}
              onSelectionChange={(id) => setState(prev => ({ ...prev, selectedChildId: id || null }))}
              placeholder="Select child tag..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Parent Tag
            </label>
            <SingleTagSelector
              selectedTag={state.selectedParentId || undefined}
              onSelectionChange={(id) => setState(prev => ({ ...prev, selectedParentId: id || null }))}
              placeholder="Select parent tag..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAddParentRelationship}
            disabled={!state.selectedChildId || !state.selectedParentId || loading}
            className="px-4 py-2 text-sm rounded-xl bg-primary-500 text-white hover:bg-primary-600 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add Parent Relationship
          </button>

          <button
            onClick={handleRemoveParentRelationship}
            disabled={!state.selectedChildId || !state.selectedParentId || loading}
            className="px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Remove Parent Relationship
          </button>
        </div>
      </div>

      {state.selectedChildId && (
        <TagRelationshipViewer tagId={state.selectedChildId} />
      )}
    </div>
  );

  const renderBulkTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6">
        <h3
          className="text-base font-bold text-slate-900 dark:text-slate-100 mb-5 tracking-tight"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          Bulk Parent Assignment
        </h3>

        <div className="space-y-5 mb-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Parent Tag
            </label>
            <SingleTagSelector
              selectedTag={state.selectedParentId || undefined}
              onSelectionChange={(id) => setState(prev => ({ ...prev, selectedParentId: id || null }))}
              placeholder="Select parent tag for bulk assignment..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Child Tags
            </label>
            <TagSelector
              selectedTags={state.bulkChildIds}
              onSelectionChange={(ids) => setState(prev => ({ ...prev, bulkChildIds: ids }))}
              placeholder="Select multiple child tags..."
              multiSelect={true}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleBulkAddParent}
            disabled={!state.selectedParentId || state.bulkChildIds.length === 0 || loading}
            className="px-4 py-2 text-sm rounded-xl bg-primary-500 text-white hover:bg-primary-600 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add Parent to {state.bulkChildIds.length} Tags
          </button>

          <button
            onClick={() => setState(prev => ({ ...prev, bulkChildIds: [], selectedParentId: null }))}
            className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-xl p-4 text-sm">
        <p className="font-semibold mb-1">Warning</p>
        <p>Bulk operations cannot be easily undone. Please verify your selection before proceeding. This will attempt to add the selected parent to all selected child tags. Individual failures will be reported.</p>
      </div>
    </div>
  );

  const renderCreateTab = () => (
    <div>
      <CreateTagForm
        onSuccess={showOperationResult}
        onError={showOperationError}
      />
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shrink-0">
        <h1
          className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 tracking-tight"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          Tag Hierarchy Management
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage tag relationships, view hierarchies, and perform bulk operations
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          <TabButton active={state.activeTab === 'tree'} onClick={() => handleTabChange('tree')}>
            Tree View
          </TabButton>
          <TabButton active={state.activeTab === 'create'} onClick={() => handleTabChange('create')}>
            Create Tags
          </TabButton>
          <TabButton active={state.activeTab === 'relationships'} onClick={() => handleTabChange('relationships')}>
            Relationships
          </TabButton>
          <TabButton active={state.activeTab === 'bulk'} onClick={() => handleTabChange('bulk')}>
            Bulk Operations
          </TabButton>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Operation Messages (toast-style) */}
        {state.operationResult && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl p-4 text-sm whitespace-pre-wrap">
            {state.operationResult}
          </div>
        )}

        {state.operationError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm whitespace-pre-wrap">
            {state.operationError}
          </div>
        )}

        {/* Global Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-200 font-bold text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Tab content */}
        {state.activeTab === 'tree' && renderTreeTab()}
        {state.activeTab === 'create' && renderCreateTab()}
        {state.activeTab === 'relationships' && renderRelationshipsTab()}
        {state.activeTab === 'bulk' && renderBulkTab()}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
        active
          ? 'bg-primary-50 dark:bg-primary-900/25 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800/50'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent'
      }`}
    >
      {children}
    </button>
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
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        <span>Loading relationships...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6">
      <h4
        className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 tracking-tight"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        Relationships for "{tagNode?.name}" (ID: {tagId})
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Ancestors ({ancestors.length})
          </h5>
          {ancestors.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">No ancestor tags</p>
          ) : (
            <ul className="space-y-1">
              {ancestors.map(ancestor => (
                <li
                  key={ancestor.id}
                  className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg"
                >
                  {ancestor.name}
                  <span className="text-slate-400 dark:text-slate-500 ml-1.5 text-xs">
                    ID: {ancestor.id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Descendants ({descendants.length})
          </h5>
          {descendants.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">No descendant tags</p>
          ) : (
            <ul className="space-y-1">
              {descendants.map(descendant => (
                <li
                  key={descendant.id}
                  className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg"
                >
                  {descendant.name}
                  <span className="text-slate-400 dark:text-slate-500 ml-1.5 text-xs">
                    ID: {descendant.id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
