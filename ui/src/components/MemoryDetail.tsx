import { Memory } from '../types/memory';
import './MemoryDetail.css';

interface MemoryDetailProps {
  memory: Memory;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MemoryDetail({ memory, onClose, onEdit, onDelete }: MemoryDetailProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${memory.name}"?`)) {
      onDelete?.();
    }
  };

  return (
    <div className="memory-detail-backdrop" onClick={handleBackdropClick}>
      <div className="memory-detail-modal">
        <div className="memory-detail-header">
          <h1 className="memory-detail-title">{memory.name}</h1>
          <div className="memory-detail-actions">
            {onEdit && (
              <button
                onClick={onEdit}
                className="action-btn edit-btn"
                title="Edit memory"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path 
                    d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13M18.5 2.50023C18.8978 2.10243 19.4374 1.87896 20 1.87896C20.5626 1.87896 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.4376 22.1213 4.00023C22.1213 4.56286 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="action-btn delete-btn"
                title="Delete memory"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path 
                    d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="action-btn close-btn"
              title="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path 
                  d="M18 6L6 18M6 6L18 18" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="memory-detail-content">
          <div className="memory-content">
            <pre className="memory-text">{memory.content}</pre>
          </div>

          {memory.url && (
            <div className="memory-url">
              <h3>Reference URL</h3>
              <a 
                href={memory.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="url-link"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path 
                    d="M10 13C10.4295 13.5741 10.9774 14.0491 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.47L11.75 5.18" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M14 11C13.5705 10.4259 13.0226 9.95085 12.3934 9.60707C11.7643 9.26329 11.0685 9.0589 10.3533 9.00769C9.63819 8.95648 8.92037 9.05969 8.24864 9.31025C7.57691 9.56082 6.9669 9.95301 6.46 10.46L3.46 13.46C2.54918 14.403 2.04520 15.6661 2.0566 16.9770C2.06799 18.288 2.59383 19.5421 3.52087 20.4691C4.44791 21.3962 5.70198 21.922 7.01296 21.9334C8.32394 21.9448 9.58695 21.4408 10.53 20.53L12.24 18.82" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                {memory.url}
              </a>
            </div>
          )}

          {memory.tags && memory.tags.length > 0 && (
            <div className="memory-tags">
              <h3>Tags</h3>
              <div className="tag-list">
                {memory.tags.map((tag, index) => (
                  <span key={index} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="memory-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Created:</span>
              <span className="metadata-value">{formatDate(memory.created_at)}</span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Updated:</span>
              <span className="metadata-value">{formatDate(memory.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}