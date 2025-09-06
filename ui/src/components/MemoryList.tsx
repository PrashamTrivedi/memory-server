import { useState } from 'react';
import { Memory } from '../types/memory';
import { MemoryCard } from './MemoryCard';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import './MemoryList.css';

interface MemoryListProps {
  memories: Memory[];
  loading?: boolean;
  error?: string | null;
  onMemoryClick?: (memory: Memory) => void;
  onMemoryEdit?: (memory: Memory) => void;
  onMemoryDelete?: (memory: Memory) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function MemoryList({
  memories,
  loading = false,
  error = null,
  onMemoryClick,
  onMemoryEdit,
  onMemoryDelete,
  onLoadMore,
  hasMore = false,
}: MemoryListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (memory: Memory) => {
    if (window.confirm(`Are you sure you want to delete "${memory.name}"?`)) {
      setDeletingId(memory.id);
      try {
        await onMemoryDelete?.(memory);
      } catch (error) {
        console.error('Failed to delete memory:', error);
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (loading && memories.length === 0) {
    return (
      <div className="memory-list-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && memories.length === 0) {
    return (
      <div className="memory-list-container">
        <ErrorMessage 
          message={error} 
          onRetry={() => window.location.reload()} 
        />
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="memory-list-container">
        <div className="empty-state">
          <svg 
            className="empty-state-icon" 
            width="64" 
            height="64" 
            viewBox="0 0 24 24" 
            fill="none"
          >
            <path 
              d="M9 12H15M9 16H15M17 21H7C6.46957 21 5.96086 20.7893 5.58579 20.4142C5.21071 20.0391 5 19.5304 5 19V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H12.586C12.8512 3.00006 13.1055 3.10545 13.293 3.293L18.707 8.707C18.8946 8.89449 18.9999 9.14881 19 9.414V19C19 19.5304 18.7893 20.0391 18.4142 20.4142C18.0391 20.7893 17.5304 21 17 21Z" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          <h3>No memories found</h3>
          <p>Start by creating your first memory to organize your development knowledge.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="memory-list-container">
      <div className="memory-grid">
        {memories.map((memory) => (
          <div
            key={memory.id}
            className={`memory-item ${deletingId === memory.id ? 'deleting' : ''}`}
          >
            <MemoryCard
              memory={memory}
              onClick={() => onMemoryClick?.(memory)}
              onEdit={() => onMemoryEdit?.(memory)}
              onDelete={() => handleDelete(memory)}
            />
            {deletingId === memory.id && (
              <div className="delete-overlay">
                <LoadingSpinner size="small" />
              </div>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="load-more-btn"
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
}