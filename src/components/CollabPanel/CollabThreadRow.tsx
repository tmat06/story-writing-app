'use client';

import { relativeTime } from '@/lib/relativeTime';
import type { CollabThread, ThreadStatus } from '@/types/collaboration';
import styles from './CollabThreadRow.module.css';

interface Props {
  thread: CollabThread;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: ThreadStatus) => void;
  onJumpToScene: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  question: 'Question',
  suggestion: 'Suggestion',
  decision: 'Decision',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  'needs-author': 'Needs author',
  resolved: 'Resolved',
};

export function CollabThreadRow({ thread, isExpanded, onToggle, onStatusChange, onJumpToScene }: Props) {
  return (
    <div
      className={`${styles.row} ${isExpanded ? styles.rowExpanded : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className={styles.rowMain}>
        <span className={`${styles.chip} ${styles[`chip_${thread.type}`]}`}>
          {TYPE_LABELS[thread.type]}
        </span>
        <span className={styles.title}>{thread.title}</span>
        <span className={`${styles.statusChip} ${styles[`status_${thread.status.replace('-', '_')}`]}`}>
          {STATUS_LABELS[thread.status]}
        </span>
      </div>
      <div className={styles.rowMeta}>
        {thread.assignee && (
          <span className={styles.metaItem}>{thread.assignee}</span>
        )}
        <span className={styles.metaItem}>{thread.sceneTitle}</span>
        <span className={styles.metaItem}>{relativeTime(thread.updatedAt)}</span>
        <button
          className={styles.jumpBtn}
          aria-label={`Jump to scene ${thread.sceneTitle}`}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onJumpToScene();
          }}
        >
          Jump to scene
        </button>
      </div>
      {thread.status !== 'resolved' && (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          {thread.status !== 'needs-author' && (
            <button
              className={styles.actionBtn}
              onClick={() => onStatusChange('needs-author')}
              aria-label="Mark needs author"
            >
              Needs author
            </button>
          )}
          {thread.status !== 'open' && (
            <button
              className={styles.actionBtn}
              onClick={() => onStatusChange('open')}
              aria-label="Mark open"
            >
              Open
            </button>
          )}
          <button
            className={styles.actionBtn}
            onClick={() => onStatusChange('resolved')}
            aria-label="Mark resolved"
          >
            Resolve
          </button>
        </div>
      )}
    </div>
  );
}
