import React, { useState } from 'react';
import './HierarchicalTagInput.css';

interface HierarchicalTagInputProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function HierarchicalTagInput({ 
  selectedTags, 
  onTagsChange, 
  disabled = false, 
  placeholder = "Add tags... (e.g., 'parent>child' or 'simple')"
}: HierarchicalTagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !selectedTags.includes(newTag)) {
        onTagsChange([...selectedTags, newTag]);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      onTagsChange(selectedTags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const isHierarchicalTag = (tag: string) => tag.includes('>');

  const renderTag = (tag: string, index: number) => {
    const isHierarchical = isHierarchicalTag(tag);
    
    if (isHierarchical) {
      const parts = tag.split('>');
      if (parts.length === 2) {
        return (
          <span key={index} className="tag-chip hierarchical">
            <span className="tag-parent">{parts[0].trim()}</span>
            <span className="tag-separator">→</span>
            <span className="tag-child">{parts[1].trim()}</span>
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
        );
      }
    }
    
    return (
      <span key={index} className="tag-chip simple">
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
    );
  };

  return (
    <div className="hierarchical-tag-input">
      <div className="tag-input-container">
        {selectedTags.map(renderTag)}
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
      
      <div className="tag-input-help">
        <p className="help-text">
          <strong>Tag formats:</strong>
        </p>
        <ul className="help-list">
          <li><span className="format-example">simple-tag</span> - Regular tag</li>
          <li><span className="format-example">parent&gt;child</span> - Hierarchical tag (parent-child relationship)</li>
        </ul>
        <p className="help-note">
          Press <kbd>Enter</kbd> or <kbd>,</kbd> to add a tag
        </p>
      </div>
    </div>
  );
}