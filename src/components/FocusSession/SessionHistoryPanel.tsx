'use client';

import type { FocusSession } from '@/types/session';
import { OBJECTIVE_LABELS } from '@/types/session';
import { relativeTime } from '@/lib/relativeTime';
import styles from './SessionHistoryPanel.module.css';

interface SessionHistoryPanelProps {
  sessions: FocusSession[];
}

export function SessionHistoryPanel({ sessions }: SessionHistoryPanelProps) {

  if (sessions.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No sessions recorded yet for this story.</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {sessions.map((session) => {
        const wordsAdded = session.wordsAtEnd != null
          ? Math.max(0, session.wordsAtEnd - session.wordsAtStart)
          : null;
        const isComplete = session.objectiveStatus === 'complete';
        const handoffSnippet =
          session.handoffNote.length > 80
            ? session.handoffNote.slice(0, 80) + '…'
            : session.handoffNote;
        const objectiveLabel = OBJECTIVE_LABELS[session.objectiveType] ?? session.objectiveType;

        return (
          <div key={session.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.sceneName}>{session.sceneName}</span>
              <span className={styles.timestamp}>{relativeTime(session.startedAt)}</span>
            </div>
            <div className={styles.cardMeta}>
              <span className={styles.objective}>{objectiveLabel}</span>
              <span
                className={`${styles.badge} ${isComplete ? styles.badgeComplete : styles.badgeIncomplete}`}
              >
                {isComplete ? 'Complete' : 'Incomplete'}
              </span>
              {wordsAdded != null && (
                <span className={styles.words}>+{wordsAdded} words</span>
              )}
            </div>
            {handoffSnippet && (
              <p className={styles.handoff}>{handoffSnippet}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
