'use client';

import styles from './ErrorBanner.module.css';

interface ErrorBannerProps {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ErrorBanner({ error: _error, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div role="alert" className={styles.banner}>
      <span className={styles.icon} aria-hidden="true">⚠</span>
      <p className={styles.message}>
        Could not save changes. Check your connection or available storage.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.retryButton}
          onClick={onRetry}
        >
          Retry
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
