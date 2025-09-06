import { useState } from 'react';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({ selectedTags, onTagsChange, disabled = false }: TagSelectorProps) {
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

  return (
    <div className="tag-selector">
      <div className="tag-input-container">
        {selectedTags.map((tag, index) => (
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
          placeholder="Add tags..."
          disabled={disabled}
          className="tag-input"
        />
      </div>
    </div>
  );
}

// For compatibility with the form
export const SingleTagSelector = TagSelector;