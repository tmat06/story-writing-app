import type { ReminderStatus } from '@/types/submission';
import styles from './ReminderStatusChip.module.css';

interface ReminderStatusChipProps {
  status: ReminderStatus;
}

export function ReminderStatusChip({ status }: ReminderStatusChipProps) {
  if (status === 'none' || status === 'on_track') return null;

  if (status === 'follow_up_due') {
    return <span className={styles.followUpDue}>Follow-up due</span>;
  }

  return <span className={styles.overdue}>Overdue</span>;
}
