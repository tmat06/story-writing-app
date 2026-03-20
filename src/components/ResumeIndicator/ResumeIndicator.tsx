'use client';

import styles from './ResumeIndicator.module.css';

interface ResumeIndicatorProps {
  onDismiss: () => void;
  optOut: boolean;
  onOptOutChange: (value: boolean) => void;
}

export function ResumeIndicator({ onDismiss, optOut, onOptOutChange }: ResumeIndicatorProps) {
  return (
    <div role="status" className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">↩</span>
        <span className={styles.message}>Resumed from last position</span>
      </div>
      <div className={styles.actions}>
        <label className={styles.optOutLabel}>
          <input
            type="checkbox"
            className={styles.optOutCheckbox}
            checked={optOut}
            onChange={(e) => onOptOutChange(e.target.checked)}
          />
          Don&apos;t restore position for this story
        </label>
        <button
          type="button"
          className={styles.dismissButton}
          onClick={onDismiss}
          aria-label="Dismiss resume indicator"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
