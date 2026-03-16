import type { SubmissionEntry, SubmissionStatus } from '@/types/submission';
import { SUBMISSION_STATUS_LABELS } from '@/lib/submissions';
import { SubmissionCard } from './SubmissionCard';
import styles from './SubmissionBoard.module.css';

const COLUMNS: SubmissionStatus[] = [
  'drafting',
  'submitted',
  'requested_revisions',
  'closed',
];

interface SubmissionBoardProps {
  entries: SubmissionEntry[];
  onCardClick: (id: string) => void;
  highlightedId?: string | null;
}

export function SubmissionBoard({ entries, onCardClick, highlightedId }: SubmissionBoardProps) {
  const activeEntries = entries.filter((e) => !e.archivedAt);

  return (
    <div className={styles.board}>
      {COLUMNS.map((status) => {
        const columnEntries = activeEntries.filter((e) => e.status === status);
        return (
          <div key={status} className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnTitle}>
                {SUBMISSION_STATUS_LABELS[status]}
              </span>
              <span className={styles.columnCount}>{columnEntries.length}</span>
            </div>
            <div className={styles.columnBody}>
              {columnEntries.length === 0 ? (
                <p className={styles.empty}>No entries</p>
              ) : (
                columnEntries.map((entry) => (
                  <SubmissionCard
                    key={entry.id}
                    entry={entry}
                    onClick={() => onCardClick(entry.id)}
                    highlighted={highlightedId === entry.id}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
