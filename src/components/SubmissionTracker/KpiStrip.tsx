import type { SubmissionEntry } from '@/types/submission';
import { computeReminderStatus } from '@/lib/submissions';
import styles from './KpiStrip.module.css';

interface KpiStripProps {
  entries: SubmissionEntry[];
}

export function KpiStrip({ entries }: KpiStripProps) {
  const active = entries.filter((e) => !e.archivedAt && e.status !== 'closed');
  const awaitingResponse = entries.filter(
    (e) => !e.archivedAt && e.status === 'submitted' && !e.responseDate
  );
  const followUpDue = entries.filter(
    (e) => !e.archivedAt && computeReminderStatus(e) === 'follow_up_due'
  );
  const overdue = entries.filter(
    (e) => !e.archivedAt && computeReminderStatus(e) === 'overdue'
  );

  const items = [
    { label: 'Active', count: active.length },
    { label: 'Awaiting Response', count: awaitingResponse.length },
    { label: 'Follow-up due', count: followUpDue.length },
    { label: 'Overdue', count: overdue.length },
  ];

  return (
    <div className={styles.strip} role="region" aria-label="Submission KPIs">
      {items.map((item, i) => (
        <div key={item.label} className={styles.item}>
          {i > 0 && <span className={styles.divider} aria-hidden="true" />}
          <dl className={styles.dl}>
            <dt className={styles.label}>{item.label}</dt>
            <dd className={styles.count}>{item.count}</dd>
          </dl>
        </div>
      ))}
    </div>
  );
}
