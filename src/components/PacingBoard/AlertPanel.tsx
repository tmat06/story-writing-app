import type { PacingAlert } from '@/types/pacing';
import styles from './AlertPanel.module.css';

interface AlertPanelProps {
  alerts: PacingAlert[];
  onDismiss: (alertId: string) => void;
  onJumpToScene: (sceneId: string) => void;
}

export function AlertPanel({ alerts, onDismiss, onJumpToScene }: AlertPanelProps) {
  if (alerts.length === 0) {
    return (
      <p className={styles.emptyState}>Your pacing looks good. Keep writing!</p>
    );
  }

  return (
    <div className={styles.panel} role="list" aria-label="Pacing alerts">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`${styles.alertCard} ${alert.severity === 'warning' ? styles.alertCardWarning : styles.alertCardInfo}`}
          role="listitem"
        >
          <span className={styles.alertIcon} aria-hidden="true">
            {alert.severity === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <div className={styles.alertBody}>
            <p className={styles.alertMessage}>{alert.message}</p>
            {alert.sceneId && (
              <div className={styles.alertActions}>
                <button
                  type="button"
                  className={styles.jumpButton}
                  onClick={() => onJumpToScene(alert.sceneId!)}
                >
                  → Go to scene
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.dismissButton}
            aria-label="Dismiss this alert"
            onClick={() => onDismiss(alert.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
