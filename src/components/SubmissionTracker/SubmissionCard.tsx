import type { SubmissionEntry } from '@/types/submission';
import { SUBMISSION_STATUS_LABELS, computeReminderStatus } from '@/lib/submissions';
import { ReminderStatusChip } from './ReminderStatusChip';
import styles from './SubmissionCard.module.css';

interface SubmissionCardProps {
  entry: SubmissionEntry;
  onClick: () => void;
  highlighted?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SubmissionCard({ entry, onClick, highlighted }: SubmissionCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const reminderStatus = computeReminderStatus(entry);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.card} ${highlighted ? styles.highlighted : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`Submission: ${entry.recipientName}`}
    >
      <div className={styles.topRow}>
        <span className={styles.recipient}>{entry.recipientName || 'Untitled'}</span>
        <ReminderStatusChip status={reminderStatus} />
      </div>

      {entry.channelType && (
        <span className={styles.channel}>{entry.channelType}</span>
      )}

      <div className={styles.dates}>
        <span className={styles.dateItem}>
          <span className={styles.dateLabel}>Sent</span>
          {formatDate(entry.sentDate)}
        </span>
        {entry.responseDate && (
          <span className={styles.dateItem}>
            <span className={styles.dateLabel}>Response</span>
            {formatDate(entry.responseDate)}
          </span>
        )}
        {entry.nextActionDate && (
          <span className={styles.dateItem}>
            <span className={styles.dateLabel}>Next action</span>
            {formatDate(entry.nextActionDate)}
          </span>
        )}
      </div>

      {entry.responseType && (
        <span className={styles.responseType}>
          {entry.responseType.replace(/_/g, ' ')}
        </span>
      )}

      {entry.linkedArtifactId ? (
        <span className={styles.artifact}>
          Package: <code>{entry.linkedArtifactId}</code>
        </span>
      ) : (
        <span className={styles.artifactEmpty}>No linked package</span>
      )}
    </div>
  );
}
