import type { CollabThread, ThreadStatus } from '@/types/collaboration';
import styles from './CollabThreadRow.module.css';

const TYPE_LABELS: Record<CollabThread['type'], string> = {
  question: 'Question',
  suggestion: 'Suggestion',
  decision: 'Decision',
};

const STATUS_LABELS: Record<ThreadStatus, string> = {
  open: 'Open',
  'needs-author': 'Needs Author',
  resolved: 'Resolved',
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface CollabThreadRowProps {
  thread: CollabThread;
  isActive: boolean;
  onSelect: (id: string) => void;
  onSceneJump: (sceneId: string | null) => void;
  onStatusChange: (threadId: string, status: ThreadStatus) => void;
}

export function CollabThreadRow({
  thread,
  isActive,
  onSelect,
  onSceneJump,
  onStatusChange,
}: CollabThreadRowProps) {
  return (
    <div
      className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={isActive}
      onClick={() => onSelect(thread.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(thread.id);
        }
      }}
    >
      <div className={styles.rowHeader}>
        <span className={`${styles.chip} ${styles[`type_${thread.type}`]}`}>
          {TYPE_LABELS[thread.type]}
        </span>
        <span className={`${styles.chip} ${styles[`status_${thread.status.replace('-', '_')}`]}`}>
          {STATUS_LABELS[thread.status]}
        </span>
        <span className={styles.time}>{relativeTime(thread.updatedAt)}</span>
      </div>
      <div className={styles.title}>{thread.title}</div>
      <div className={styles.meta}>
        <span className={styles.metaItem}>{thread.sceneTitle}</span>
        {thread.assignee && (
          <span className={styles.metaItem}>@{thread.assignee}</span>
        )}
      </div>
      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.jumpBtn}
          onClick={() => onSceneJump(thread.sceneId)}
          tabIndex={0}
          aria-label={`Jump to ${thread.sceneTitle}`}
        >
          Jump to scene
        </button>
        {thread.status !== 'open' && (
          <button
            className={styles.actionBtn}
            onClick={() => onStatusChange(thread.id, 'open')}
            tabIndex={0}
          >
            Set Open
          </button>
        )}
        {thread.status !== 'needs-author' && (
          <button
            className={styles.actionBtn}
            onClick={() => onStatusChange(thread.id, 'needs-author')}
            tabIndex={0}
          >
            Needs Author
          </button>
        )}
        {thread.status !== 'resolved' && (
          <button
            className={styles.actionBtn}
            onClick={() => onStatusChange(thread.id, 'resolved')}
            tabIndex={0}
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}
