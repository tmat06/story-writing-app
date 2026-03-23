'use client';

import { useMemo } from 'react';
import type { SubmissionEntry, ReminderStatus } from '@/types/submission';
import { computeReminderStatus } from '@/lib/submissions';
import styles from './ReminderDigest.module.css';

interface ReminderDigestProps {
  entries: SubmissionEntry[];
  onMarkFollowedUp: (id: string) => void;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}

interface DigestItem {
  entry: SubmissionEntry;
  status: ReminderStatus;
  daysAgo: number;
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA.slice(0, 10)).getTime();
  const b = new Date(isoB.slice(0, 10)).getTime();
  return Math.round((b - a) / 86400000);
}

export function ReminderDigest({ entries, onMarkFollowedUp, onSnooze, onDismiss }: ReminderDigestProps) {
  const today = new Date().toISOString().slice(0, 10);

  const { overdueItems, dueItems, onTrackCount, allActionable } = useMemo(() => {
    const withStatus: DigestItem[] = entries.map((e) => ({
      entry: e,
      status: computeReminderStatus(e),
      daysAgo: e.sentDate ? daysBetween(e.sentDate, today) : 0,
    }));

    const overdueItems = withStatus.filter((i) => i.status === 'overdue');
    const dueItems = withStatus.filter((i) => i.status === 'follow_up_due');
    const onTrackCount = withStatus.filter((i) => i.status === 'on_track').length;
    const allActionable = [...overdueItems, ...dueItems];

    return { overdueItems, dueItems, onTrackCount, allActionable };
  }, [entries, today]);

  return (
    <div className={styles.digest} role="region" aria-label="Reminder digest">
      <div className={styles.countStrip}>
        {overdueItems.length > 0 && (
          <span className={styles.countPillOverdue}>{overdueItems.length} Overdue</span>
        )}
        {dueItems.length > 0 && (
          <span className={styles.countPillDue}>{dueItems.length} Due this week</span>
        )}
        {onTrackCount > 0 && (
          <span className={styles.countPillOnTrack}>{onTrackCount} On track</span>
        )}
      </div>

      {allActionable.length === 0 ? (
        <p className={styles.emptyState}>No follow-ups due</p>
      ) : (
        <ul className={styles.list} role="list">
          {allActionable.map(({ entry, status, daysAgo }) => (
            <li key={entry.id} className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.recipient}>{entry.recipientName || 'Untitled'}</span>
                {entry.channelType && (
                  <span className={styles.channel}>{entry.channelType}</span>
                )}
                <span className={styles.dueContext}>
                  {status === 'overdue'
                    ? `Overdue — sent ${daysAgo} days ago`
                    : `Follow-up due — sent ${daysAgo} days ago`}
                </span>
              </div>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => onMarkFollowedUp(entry.id)}
                  aria-label={`Mark followed up for ${entry.recipientName}`}
                >
                  Mark followed up
                </button>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => onSnooze(entry.id)}
                  aria-label={`Snooze 7 days for ${entry.recipientName}`}
                >
                  Snooze 7d
                </button>
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.actionButtonDismiss}`}
                  onClick={() => onDismiss(entry.id)}
                  aria-label={`Dismiss reminder for ${entry.recipientName}`}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
