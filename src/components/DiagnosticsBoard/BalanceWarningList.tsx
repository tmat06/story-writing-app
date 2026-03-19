import { useState } from 'react';
import type { DiagnosticWarning, DiagnosticThresholds } from '@/types/diagnostics';
import styles from './BalanceWarningList.module.css';

interface BalanceWarningListProps {
  warnings: DiagnosticWarning[];
  thresholds: DiagnosticThresholds;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
  onJumpToScene: (sceneId: string) => void;
}

const SEVERITY_LABELS: Record<string, string> = {
  alert: 'Alert',
  warning: 'Warning',
  info: 'Info',
};

export function BalanceWarningList({ warnings, thresholds, onDismiss, onSnooze, onJumpToScene }: BalanceWarningListProps) {
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});

  function showConfirmation(id: string, text: string) {
    setConfirmations((prev) => ({ ...prev, [id]: text }));
    setTimeout(() => {
      setConfirmations((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 2000);
  }

  if (warnings.length === 0) {
    return (
      <div className={styles.card}>
        <h3 className={styles.heading}>Balance Warnings</h3>
        <p className={styles.empty}>No balance issues detected. Your manuscript looks well-balanced.</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Balance Warnings</h3>
      <ul role="list" className={styles.list}>
        {warnings.map((w) => (
          <li key={w.id} role="listitem" className={`${styles.item} ${styles[`item--${w.severity}`]}`}>
            <div className={styles.itemHeader}>
              <span className={`${styles.badge} ${styles[`badge--${w.severity}`]}`}>
                {SEVERITY_LABELS[w.severity]}
              </span>
              <span className={styles.message}>{w.message}</span>
            </div>
            <div className={styles.itemActions}>
              {w.sceneIds.map((sceneId) => (
                <button
                  key={sceneId}
                  className={styles.jumpBtn}
                  onClick={() => onJumpToScene(sceneId)}
                >
                  → Go to scene
                </button>
              ))}
              {confirmations[w.id] ? (
                <span className={styles.confirmation} aria-live="polite">{confirmations[w.id]}</span>
              ) : (
                <>
                  <button
                    className={styles.actionBtn}
                    aria-label="Dismiss"
                    onClick={() => {
                      onDismiss(w.id);
                      showConfirmation(w.id, 'Dismissed');
                    }}
                  >
                    Dismiss
                  </button>
                  <button
                    className={styles.actionBtn}
                    aria-label={`Snooze for ${thresholds.snoozeHours} hours`}
                    onClick={() => {
                      onSnooze(w.id);
                      showConfirmation(w.id, `Snoozed ${thresholds.snoozeHours}h`);
                    }}
                  >
                    Snooze {thresholds.snoozeHours}h
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
