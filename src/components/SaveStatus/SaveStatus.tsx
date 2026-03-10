'use client';

import { useState, useEffect } from 'react';
import { formatRelativeTime } from '@/lib/autosave';
import type { SaveState } from '@/hooks/useAutosave';
import styles from './SaveStatus.module.css';

interface SaveStatusProps {
  saveState: SaveState;
  lastSaved: number | null;
  onRetry?: () => void;
}

export function SaveStatus({ saveState, lastSaved, onRetry }: SaveStatusProps) {
  // Re-render every 30s to keep relative timestamp fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.row}>
      <span aria-live="polite" className={styles.statusText} data-state={saveState}>
        {saveState === 'saving' && <span className={styles.saving}>Saving…</span>}
        {saveState === 'saved' && lastSaved && (
          <span className={styles.saved}>Saved {formatRelativeTime(lastSaved)}</span>
        )}
        {saveState === 'saved' && !lastSaved && (
          <span className={styles.saved}>Saved</span>
        )}
        {saveState === 'failed' && (
          <>
            <span className={styles.failed}>Save failed</span>
            {onRetry && (
              <button
                type="button"
                className={styles.retryButton}
                onClick={onRetry}
              >
                Retry
              </button>
            )}
          </>
        )}
        {saveState === 'idle' && !lastSaved && (
          <span className={styles.idle}>Not saved yet</span>
        )}
        {saveState === 'idle' && lastSaved && (
          <span className={styles.saved}>Saved {formatRelativeTime(lastSaved)}</span>
        )}
      </span>
    </div>
  );
}
