'use client';

import { useEffect, useRef } from 'react';
import { formatRelativeTime } from '@/lib/autosave';
import styles from './RecoveryBanner.module.css';

interface RecoveryBannerProps {
  snapshotTimestamp: number;
  onRestore: () => void;
  onDismiss: () => void;
}

export function RecoveryBanner({ snapshotTimestamp, onRestore, onDismiss }: RecoveryBannerProps) {
  const restoreRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    restoreRef.current?.focus();
  }, []);

  return (
    <div role="alert" className={styles.banner}>
      <span className={styles.icon} aria-hidden="true">ℹ</span>
      <p className={styles.message}>
        Unsaved draft found from previous session (last edited {formatRelativeTime(snapshotTimestamp)})
      </p>
      <div className={styles.actions}>
        <button
          ref={restoreRef}
          type="button"
          className={styles.restoreButton}
          onClick={onRestore}
        >
          Restore draft
        </button>
        <button
          type="button"
          className={styles.dismissButton}
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
