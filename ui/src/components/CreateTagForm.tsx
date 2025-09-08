import React, { useState } from 'react';
import { useTagHierarchy } from '../hooks/useTagHierarchy';
import { LoadingSpinner } from './LoadingSpinner';
import './CreateTagForm.css';

interface CreateTagFormProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export function CreateTagForm({ 
  onSuccess, 
  onError, 
  onClose, 
  isModal = false 
}: CreateTagFormProps) {
  const [formData, setFormData] = useState({
    childName: '',
    parentName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { createTagsWithParent } = useTagHierarchy();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.childName.trim()) {
      newErrors.childName = 'Child tag name is required';
    }

    if (!formData.parentName.trim()) {
      newErrors.parentName = 'Parent tag name is required';
    }

    if (formData.childName.trim() && formData.parentName.trim()) {
      if (formData.childName.trim().toLowerCase() === formData.parentName.trim().toLowerCase()) {
        newErrors.form = 'A tag cannot be its own parent';
      }
    }

    // Check for invalid characters
    const invalidChars = /[<>]/;
    if (formData.childName && invalidChars.test(formData.childName)) {
      newErrors.childName = 'Tag names cannot contain < or > characters';
    }
    if (formData.parentName && invalidChars.test(formData.parentName)) {
      newErrors.parentName = 'Tag names cannot contain < or > characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await createTagsWithParent(
        formData.childName.trim(),
        formData.parentName.trim()
      );

      const message = result.message || 
        `Successfully created "${formData.childName}" with parent "${formData.parentName}"`;
      
      onSuccess?.(message);
      
      // Reset form
      setFormData({
        childName: '',
        parentName: '',
      });
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to create tag hierarchy';
      onError?.(errorMessage);
      setErrors({ form: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (errors.form) {
      setErrors(prev => ({ ...prev, form: '' }));
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="create-tag-form">
      <div className="form-header">
        <h3>Create Tag Hierarchy</h3>
        <p className="form-description">
          Create a new tag with a parent-child relationship. Both tags will be created if they don't exist.
        </p>
      </div>

      {errors.form && (
        <div className="form-error">
          {errors.form}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="parentName" className="form-label">
          Parent Tag Name *
        </label>
        <input
          type="text"
          id="parentName"
          value={formData.parentName}
          onChange={(e) => handleInputChange('parentName', e.target.value)}
          className={`form-input ${errors.parentName ? 'error' : ''}`}
          placeholder="Enter parent tag name"
          disabled={isSubmitting}
        />
        {errors.parentName && (
          <div className="field-error">{errors.parentName}</div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="childName" className="form-label">
          Child Tag Name *
        </label>
        <input
          type="text"
          id="childName"
          value={formData.childName}
          onChange={(e) => handleInputChange('childName', e.target.value)}
          className={`form-input ${errors.childName ? 'error' : ''}`}
          placeholder="Enter child tag name"
          disabled={isSubmitting}
        />
        {errors.childName && (
          <div className="field-error">{errors.childName}</div>
        )}
      </div>

      <div className="hierarchy-preview">
        <div className="preview-label">Preview:</div>
        <div className="preview-hierarchy">
          <span className="preview-parent">
            {formData.parentName || 'Parent Tag'}
          </span>
          <span className="preview-arrow">→</span>
          <span className="preview-child">
            {formData.childName || 'Child Tag'}
          </span>
        </div>
      </div>

      <div className="form-actions">
        {isModal && (
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting || !formData.childName.trim() || !formData.parentName.trim()}
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="small" />
              Creating...
            </>
          ) : (
            'Create Tag Hierarchy'
          )}
        </button>
      </div>
    </form>
  );

  if (isModal) {
    return (
      <div className="modal-overlay">
        <div className="modal-content create-tag-modal">
          <button
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
          {formContent}
        </div>
      </div>
    );
  }

  return <div className="create-tag-form-container">{formContent}</div>;
}