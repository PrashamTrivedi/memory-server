import { TemporaryMemoryWithMetadata } from '../types/memory';
import './TemporaryMemoryCard.css';

interface TemporaryMemoryCardProps {
  memory: TemporaryMemoryWithMetadata;
  onClick?: () => void;
  onPromote?: () => void;
  isPromoting?: boolean;
}

export function TemporaryMemoryCard({ memory, onClick, onPromote, isPromoting }: TemporaryMemoryCardProps) {
  // Defensive defaults for missing lifecycle data
  const accessCount = memory.access_count ?? 0;
  const stage = memory.stage ?? 1;
  const daysUntilExpiry = memory.days_until_expiry ?? 14;
  const lastAccessed = memory.last_accessed ?? memory.updated_at ?? Date.now() / 1000;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.temp-memory-card-actions')) {
      return;
    }
    onClick?.();
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getUrgencyClass = () => {
    if (daysUntilExpiry <= 3) return 'urgent';
    if (daysUntilExpiry <= 7) return 'soon';
    return 'safe';
  };

  const getUrgencyLabel = () => {
    if (daysUntilExpiry <= 3) return 'URGENT';
    if (daysUntilExpiry <= 7) return 'Soon';
    return 'Safe';
  };

  const getProgressPercent = () => {
    if (stage === 1) {
      return Math.min((accessCount / 5) * 100, 100);
    }
    return Math.min((accessCount / 15) * 100, 100);
  };

  const getProgressLabel = () => {
    if (stage === 1) {
      return `${accessCount}/5 to Stage 2`;
    }
    return `${accessCount}/15 to Permanent`;
  };

  return (
    <div className={`temp-memory-card urgency-${getUrgencyClass()}`} onClick={handleCardClick}>
      <div className="temp-memory-card-header">
        <h3 className="temp-memory-card-title">{memory.name}</h3>
        <div className="temp-memory-card-actions">
          {onPromote && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPromote();
              }}
              className="temp-memory-card-action-btn promote-btn"
              title="Promote to permanent"
              disabled={isPromoting}
            >
              {isPromoting ? (
                <span className="spinner-small" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="temp-memory-lifecycle">
        <div className="lifecycle-badges">
          <span className={`stage-badge stage-${stage}`}>
            Stage {stage}
          </span>
          <span className={`expiry-badge ${getUrgencyClass()}`}>
            {daysUntilExpiry}d left - {getUrgencyLabel()}
          </span>
        </div>

        <div className="lifecycle-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
          <span className="progress-label">{getProgressLabel()}</span>
        </div>
      </div>

      <div className="temp-memory-card-content">
        <p>{truncateContent(memory.content)}</p>
      </div>

      {memory.tags && memory.tags.length > 0 && (
        <div className="temp-memory-card-tags">
          {memory.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="memory-tag">
              {tag}
            </span>
          ))}
          {memory.tags.length > 3 && (
            <span className="memory-tag-more">+{memory.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="temp-memory-card-footer">
        <span className="temp-memory-card-stat">
          {accessCount} accesses
        </span>
        <span className="temp-memory-card-date">
          Last accessed {formatDate(lastAccessed)}
        </span>
      </div>
    </div>
  );
}
