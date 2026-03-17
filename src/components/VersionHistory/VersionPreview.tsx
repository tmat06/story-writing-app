'use client';

import { formatRelativeTime } from '@/lib/autosave';
import type { VersionEntry } from '@/lib/versions';
import styles from './VersionHistory.module.css';

interface VersionPreviewProps {
  entry: VersionEntry;
  onRestore: (versionId: string) => void;
  onClose: () => void;
}

export function VersionPreview({ entry, onRestore, onClose }: VersionPreviewProps) {
  const relativeTime = formatRelativeTime(entry.timestamp);

  return (
    <div className={styles.previewPane}>
      <div className={styles.previewHeader}>
        <button type="button" className={styles.backButton} onClick={onClose}>
          ← Back to history
        </button>
        <p className={styles.entryLabel} style={{ marginTop: 'var(--spacing-xs)' }}>
          {entry.label ?? 'Auto-checkpoint'}
        </p>
        <div className={styles.entryMeta}>
          <span>{relativeTime}</span>
          <span>{entry.wordCount} wds</span>
        </div>
      </div>
      <textarea
        className={styles.previewTextarea}
        readOnly
        value={entry.content}
        aria-label="Version content preview"
      />
      <button
        type="button"
        className={styles.previewRestoreButton}
        onClick={() => onRestore(entry.id)}
      >
        Restore from this version
      </button>
    </div>
  );
}
