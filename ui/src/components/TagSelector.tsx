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

  // Handle the case where this is used with number IDs (new TagSelector)
  if (multiSelect && onSelectionChange && typeof selectedTags[0] === 'number') {
    const selectedTagIds = selectedTags as number[];
    
    if (loading) {
      return <div className="tag-selector loading">Loading tags...</div>;
    }

    return (
      <div className="multi-tag-selector">
        <div className="selected-tags">
          {selectedTagIds.map((tagId) => {
            const tag = flatTree && Array.isArray(flatTree) ? flatTree.find(t => t.id === tagId) : null;
            return tag ? (
              <span key={tagId} className="tag-chip">
                {tag.name}
                <button
                  type="button"
                  onClick={() => {
                    onSelectionChange(selectedTagIds.filter(id => id !== tagId));
                  }}
                  className="tag-remove"
                >
                  ×
                </button>
              </span>
            ) : null;
          })}
        </div>
        
        <select
          className="tag-selector-dropdown"
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
                {'  '.repeat(tag.depth)}{tag.name}
              </option>
            )) : null}
        </select>
      </div>
    );
  }

  // Original string-based tag selector
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
    <div className="tag-selector">
      <div className="tag-input-container">
        {selectedStringTags.map((tag, index) => (
          <span key={index} className="tag-chip">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="tag-remove"
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="tag-input"
        />
      </div>
    </div>
  );
}

// Single tag selector for selecting one tag at a time
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
    return <div className="tag-selector loading">Loading tags...</div>;
  }

  return (
    <select
      className="single-tag-selector"
      value={selectedTag || ''}
      onChange={(e) => {
        const value = e.target.value;
        onSelectionChange(value ? parseInt(value) : undefined);
      }}
    >
      <option value="">{placeholder}</option>
      {flatTree && Array.isArray(flatTree) ? flatTree.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {'  '.repeat(tag.depth)}{tag.name}
        </option>
      )) : null}
    </select>
  );
}