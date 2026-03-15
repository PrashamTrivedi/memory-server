import React, { useState } from 'react';
import { useTagHierarchy } from '../hooks/useTagHierarchy';

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
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (errors.form) {
      setErrors(prev => ({ ...prev, form: '' }));
    }
  };

  const hasParent = formData.parentName.trim().length > 0;
  const hasChild = formData.childName.trim().length > 0;

  const formContent = (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h3
            className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-1"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            Create Tag Hierarchy
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Create a new tag with a parent-child relationship. Both tags will be created if they don't exist.
          </p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Form error */}
          {errors.form && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
              {errors.form}
            </div>
          )}

          {/* Parent tag */}
          <div>
            <label htmlFor="parentName" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
              Parent Tag Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="parentName"
              value={formData.parentName}
              onChange={(e) => handleInputChange('parentName', e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-400/30 ${
                errors.parentName
                  ? 'border-red-300 dark:border-red-700 focus:border-red-400 focus:ring-red-400/30'
                  : 'border-slate-200 dark:border-slate-700 focus:border-primary-400'
              } bg-white dark:bg-slate-800`}
              placeholder="e.g. Programming"
              disabled={isSubmitting}
            />
            {errors.parentName && (
              <p className="mt-1 text-xs text-red-500">{errors.parentName}</p>
            )}
          </div>

          {/* Child tag */}
          <div>
            <label htmlFor="childName" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
              Child Tag Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="childName"
              value={formData.childName}
              onChange={(e) => handleInputChange('childName', e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-400/30 ${
                errors.childName
                  ? 'border-red-300 dark:border-red-700 focus:border-red-400 focus:ring-red-400/30'
                  : 'border-slate-200 dark:border-slate-700 focus:border-primary-400'
              } bg-white dark:bg-slate-800`}
              placeholder="e.g. TypeScript"
              disabled={isSubmitting}
            />
            {errors.childName && (
              <p className="mt-1 text-xs text-red-500">{errors.childName}</p>
            )}
          </div>

          {/* Hierarchy preview */}
          <div className="bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">Preview</div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                hasParent
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800/50 text-primary-700 dark:text-primary-300'
                  : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400'
              }`}>
                {formData.parentName || 'Parent Tag'}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600 shrink-0">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                hasChild
                  ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/50 text-teal-700 dark:text-teal-300'
                  : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400'
              }`}>
                {formData.childName || 'Child Tag'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {isModal && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2 text-sm rounded-xl bg-primary-500 text-white hover:bg-primary-600 font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSubmitting || !formData.childName.trim() || !formData.parentName.trim()}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Tag Hierarchy'
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm">
        <div className="relative max-w-lg w-[90%] animate-scale-in">
          <button
            className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          {formContent}
        </div>
      </div>
    );
  }

  return formContent;
}
