'use client';

import { useEffect, useState } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  undoLabel?: string;
  onUndo?: () => void;
}

export function Toast({ message, onDismiss, undoLabel = 'Undo', onUndo }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const showTimer = setTimeout(() => setVisible(true), 10);
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 180);
    }, 2500);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className={`${styles.toast} ${visible ? styles.visible : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.message}>{message}</span>
      {onUndo && (
        <button
          type="button"
          className={styles.undoButton}
          onClick={() => {
            onUndo();
            onDismiss();
          }}
        >
          {undoLabel}
        </button>
      )}
    </div>
  );
}
