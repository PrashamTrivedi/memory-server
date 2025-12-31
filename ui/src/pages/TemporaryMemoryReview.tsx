import { useState } from 'react';
import { useTemporaryMemories, usePromoteMemory } from '../api/memory';
import { TemporaryMemoryWithMetadata } from '../types/memory';
import { TemporaryMemoryCard } from '../components/TemporaryMemoryCard';
import { MemoryDetail } from '../components/MemoryDetail';
import { LoadingSpinner } from '../components/LoadingSpinner';
import './TemporaryMemoryReview.css';

export function TemporaryMemoryReview() {
  const [selectedMemory, setSelectedMemory] = useState<TemporaryMemoryWithMetadata | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useTemporaryMemories(50, 0);
  const promoteMemoryMutation = usePromoteMemory();

  const memories = data?.memories || [];
  const total = data?.pagination?.total || 0;

  const handlePromote = async (memory: TemporaryMemoryWithMetadata) => {
    setPromotingId(memory.id);
    try {
      await promoteMemoryMutation.mutateAsync(memory.id);
      refetch();
    } finally {
      setPromotingId(null);
    }
  };

  const handleMemoryClick = (memory: TemporaryMemoryWithMetadata) => {
    setSelectedMemory(memory);
  };

  const getUrgentCount = () => memories.filter(m => m.days_until_expiry <= 3).length;
  const getSoonCount = () => memories.filter(m => m.days_until_expiry > 3 && m.days_until_expiry <= 7).length;
  const getSafeCount = () => memories.filter(m => m.days_until_expiry > 7).length;

  const renderHeader = () => (
    <div className="temp-review-header">
      <div className="header-top">
        <h1>Temporary Memories Review</h1>
        <button onClick={() => refetch()} className="refresh-btn" title="Refresh">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M1 4V10H7M23 20V14H17M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <p className="header-description">
        Review and rescue temporary memories before they expire. Promote important memories to permanent storage.
      </p>
      {total > 0 && (
        <div className="temp-review-stats">
          <div className="stat-item">
            <span className="stat-value">{total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item urgent">
            <span className="stat-value">{getUrgentCount()}</span>
            <span className="stat-label">Urgent (&le;3d)</span>
          </div>
          <div className="stat-item soon">
            <span className="stat-value">{getSoonCount()}</span>
            <span className="stat-label">Soon (4-7d)</span>
          </div>
          <div className="stat-item safe">
            <span className="stat-value">{getSafeCount()}</span>
            <span className="stat-label">Safe (&gt;7d)</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderEmptyState = () => (
    <div className="temp-review-empty">
      <div className="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <path
            d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18457 2.99721 7.13633 4.39828 5.49707C5.79935 3.85782 7.69279 2.71538 9.79619 2.24015C11.8996 1.76491 14.1003 1.98234 16.07 2.86"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22 4L12 14.01L9 11.01"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3>No Temporary Memories</h3>
      <p>All your memories are permanent. Create a temporary memory to see it here.</p>
    </div>
  );

  const renderError = () => (
    <div className="temp-review-error">
      <h3>Error loading temporary memories</h3>
      <p>{error instanceof Error ? error.message : 'An error occurred'}</p>
      <button onClick={() => refetch()} className="retry-btn">
        Try Again
      </button>
    </div>
  );

  const renderMemoryList = () => (
    <div className="temp-memory-grid">
      {memories.map((memory) => (
        <TemporaryMemoryCard
          key={memory.id}
          memory={memory}
          onClick={() => handleMemoryClick(memory)}
          onPromote={() => handlePromote(memory)}
          isPromoting={promotingId === memory.id}
        />
      ))}
    </div>
  );

  return (
    <div className="temp-review-container">
      {renderHeader()}

      <div className="temp-review-content">
        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          renderError()
        ) : memories.length === 0 ? (
          renderEmptyState()
        ) : (
          renderMemoryList()
        )}
      </div>

      {selectedMemory && (
        <MemoryDetail
          memory={{
            ...selectedMemory,
            tags: selectedMemory.tags || [],
          }}
          onClose={() => setSelectedMemory(null)}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )}
    </div>
  );
}
