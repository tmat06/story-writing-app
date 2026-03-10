import { isOverdue } from '@/lib/submissions';
import styles from './OverdueChip.module.css';

interface OverdueChipProps {
  nextActionDate: string | null;
}

export function OverdueChip({ nextActionDate }: OverdueChipProps) {
  if (!isOverdue(nextActionDate)) {
    return null;
  }

  return <span className={styles.chip}>Overdue</span>;
}
