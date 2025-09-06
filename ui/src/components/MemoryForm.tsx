import { useState, useEffect } from 'react';
import { Memory, CreateMemoryRequest, UpdateMemoryRequest } from '../types/memory';
import { TagSelector } from './TagSelector';
import { LoadingSpinner } from './LoadingSpinner';
import './MemoryForm.css';

interface MemoryFormProps {
  memory?: Memory;
  onSubmit: (data: CreateMemoryRequest | UpdateMemoryRequest) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function MemoryForm({ memory, onSubmit, onCancel, isSubmitting = false }: MemoryFormProps) {
  const [formData, setFormData] = useState({
    name: memory?.name || '',
    content: memory?.content || '',
    url: memory?.url || '',
    tags: memory?.tags || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (memory) {
      setFormData({
        name: memory.name,
        content: memory.content,
        url: memory.url || '',
        tags: memory.tags || [],
      });
    }
  }, [memory]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    if (formData.url && formData.url.trim()) {
      try {
        new URL(formData.url);
      } catch {
        newErrors.url = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const submitData = {
        name: formData.name.trim(),
        content: formData.content.trim(),
        url: formData.url.trim() || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ form: 'Failed to save memory. Please try again.' });
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="memory-form-container">
      <form onSubmit={handleSubmit} className="memory-form">
        <div className="form-header">
          <h2>{memory ? 'Edit Memory' : 'Create New Memory'}</h2>
        </div>

        {errors.form && (
          <div className="form-error">
            {errors.form}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`form-input ${errors.name ? 'error' : ''}`}
            placeholder="Enter memory name"
            disabled={isSubmitting}
          />
          {errors.name && (
            <div className="field-error">{errors.name}</div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="content" className="form-label">
            Content *
          </label>
          <textarea
            id="content"
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            className={`form-textarea ${errors.content ? 'error' : ''}`}
            placeholder="Enter memory content..."
            rows={8}
            disabled={isSubmitting}
          />
          {errors.content && (
            <div className="field-error">{errors.content}</div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="url" className="form-label">
            URL (optional)
          </label>
          <input
            type="url"
            id="url"
            value={formData.url}
            onChange={(e) => handleInputChange('url', e.target.value)}
            className={`form-input ${errors.url ? 'error' : ''}`}
            placeholder="https://example.com"
            disabled={isSubmitting}
          />
          {errors.url && (
            <div className="field-error">{errors.url}</div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Tags
          </label>
          <TagSelector
            selectedTags={formData.tags}
            onTagsChange={(tags) => handleInputChange('tags', tags)}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="small" />
                {memory ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              memory ? 'Update Memory' : 'Create Memory'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}