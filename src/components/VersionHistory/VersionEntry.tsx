'use client';

import { formatRelativeTime } from '@/lib/autosave';
import type { VersionEntry } from '@/lib/versions';
import styles from './VersionHistory.module.css';

interface VersionEntryProps {
  entry: VersionEntry;
  onPreview: (entry: VersionEntry) => void;
  onRestore: (versionId: string) => void;
}

export function VersionEntryRow({ entry, onPreview, onRestore }: VersionEntryProps) {
  const relativeTime = formatRelativeTime(entry.timestamp);
  const absoluteDate = new Date(entry.timestamp).toLocaleString();

  return (
    <div role="listitem" className={styles.entryRow}>
      {entry.label ? (
        <p className={styles.entryLabel}>{entry.label}</p>
      ) : (
        <p className={styles.entryAuto}>Auto-checkpoint</p>
      )}
      <div className={styles.entryMeta}>
        <time title={absoluteDate}>{relativeTime}</time>
        <span>{entry.wordCount} wds</span>
      </div>
      <div className={styles.entryActions}>
        <button
          type="button"
          className={styles.previewButton}
          onClick={() => onPreview(entry)}
          aria-label={`Preview version from ${relativeTime}`}
        >
          Preview
        </button>
        <button
          type="button"
          className={styles.restoreButton}
          onClick={() => onRestore(entry.id)}
          aria-label={`Restore version from ${relativeTime}`}
        >
          Restore
        </button>
      </div>
    </div>
  );
}
