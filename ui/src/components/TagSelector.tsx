import { useState } from 'react';
import { useTagHierarchy } from '../hooks/useTagHierarchy';

interface TagSelectorProps {
  selectedTags: string[] | number[];
  onTagsChange?: (tags: string[]) => void;
  onSelectionChange?: (ids: number[]) => void;
  disabled?: boolean;
  placeholder?: string;
  multiSelect?: boolean;
}

export function TagSelector({
  selectedTags,
  onTagsChange,
  onSelectionChange,
  disabled = false,
  placeholder = "Add tags...",
  multiSelect = false
}: TagSelectorProps) {
  const { flatTree, loading } = useTagHierarchy();
  const [inputValue, setInputValue] = useState('');

  // Multi-select with number IDs
  if (multiSelect && onSelectionChange && typeof selectedTags[0] === 'number') {
    const selectedTagIds = selectedTags as number[];

    if (loading) {
      return (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-400">
          <span className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          Loading tags...
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {/* Selected tag chips */}
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedTagIds.map((tagId) => {
              const tag = flatTree && Array.isArray(flatTree) ? flatTree.find(t => t.id === tagId) : null;
              return tag ? (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-900/25 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/50"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => onSelectionChange(selectedTagIds.filter(id => id !== tagId))}
                    className="text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors ml-0.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Dropdown */}
        <select
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all cursor-pointer appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a39890' d='M6 9L1 4h10z'/%3E%3C/svg%3E")` }}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (value && !selectedTagIds.includes(value)) {
              onSelectionChange([...selectedTagIds, value]);
            }
          }}
          value=""
        >
          <option value="">{placeholder}</option>
          {flatTree && Array.isArray(flatTree) ? flatTree
            .filter(tag => !selectedTagIds.includes(tag.id))
            .map((tag) => (
              <option key={tag.id} value={tag.id}>
                {'\u00A0\u00A0'.repeat(tag.depth)}{tag.name}
              </option>
            )) : null}
        </select>
      </div>
    );
  }

  // String-based tag input
  const selectedStringTags = selectedTags as string[];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !selectedStringTags.includes(newTag)) {
        onTagsChange?.([...selectedStringTags, newTag]);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedStringTags.length > 0) {
      onTagsChange?.(selectedStringTags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange?.(selectedStringTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:ring-2 focus-within:ring-primary-400/30 focus-within:border-primary-400 transition-all min-h-[42px] ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      {selectedStringTags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-900/25 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/50"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={selectedStringTags.length === 0 ? placeholder : ''}
        disabled={disabled}
        className="flex-1 min-w-[80px] bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none"
      />
    </div>
  );
}

// Single tag selector
interface SingleTagSelectorProps {
  selectedTag?: number;
  onSelectionChange: (id: number | undefined) => void;
  placeholder?: string;
}

export function SingleTagSelector({
  selectedTag,
  onSelectionChange,
  placeholder = "Select a tag..."
}: SingleTagSelectorProps) {
  const { flatTree, loading } = useTagHierarchy();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-400">
        <span className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        Loading tags...
      </div>
    );
  }

  return (
    <select
      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all cursor-pointer appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a39890' d='M6 9L1 4h10z'/%3E%3C/svg%3E")` }}
      value={selectedTag || ''}
      onChange={(e) => {
        const value = e.target.value;
        onSelectionChange(value ? parseInt(value) : undefined);
      }}
    >
      <option value="">{placeholder}</option>
      {flatTree && Array.isArray(flatTree) ? flatTree.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {'\u00A0\u00A0'.repeat(tag.depth)}{tag.name}
        </option>
      )) : null}
    </select>
  );
}
