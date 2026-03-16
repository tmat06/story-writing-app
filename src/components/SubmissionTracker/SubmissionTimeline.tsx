import type { SubmissionEntry } from '@/types/submission';
import { SubmissionCard } from './SubmissionCard';
import styles from './SubmissionTimeline.module.css';

interface SubmissionTimelineProps {
  entries: SubmissionEntry[];
  onCardClick: (id: string) => void;
  highlightedId?: string | null;
}

function getWeekStart(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  return `Week of ${d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`;
}

export function SubmissionTimeline({ entries, onCardClick, highlightedId }: SubmissionTimelineProps) {
  const activeEntries = entries.filter((e) => !e.archivedAt);

  // Group entries
  const noDateEntries: SubmissionEntry[] = [];
  const weekMap = new Map<string, SubmissionEntry[]>();

  for (const entry of activeEntries) {
    const dateStr = entry.sentDate ?? null;
    if (!dateStr) {
      noDateEntries.push(entry);
    } else {
      const week = getWeekStart(dateStr);
      if (!weekMap.has(week)) {
        weekMap.set(week, []);
      }
      weekMap.get(week)!.push(entry);
    }
  }

  // Sort weeks descending (newest first)
  const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => b.localeCompare(a));

  if (activeEntries.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No submissions yet</p>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      {sortedWeeks.map((week) => (
        <div key={week} className={styles.group}>
          <h3 className={styles.groupHeader}>{formatWeekLabel(week)}</h3>
          <div className={styles.groupEntries}>
            {weekMap.get(week)!.map((entry) => (
              <SubmissionCard
                key={entry.id}
                entry={entry}
                onClick={() => onCardClick(entry.id)}
                highlighted={highlightedId === entry.id}
              />
            ))}
          </div>
        </div>
      ))}

      {noDateEntries.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.groupHeader}>Not yet sent</h3>
          <div className={styles.groupEntries}>
            {noDateEntries.map((entry) => (
              <SubmissionCard
                key={entry.id}
                entry={entry}
                onClick={() => onCardClick(entry.id)}
                highlighted={highlightedId === entry.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
