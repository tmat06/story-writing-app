import Link from 'next/link';
import styles from './NextUpQueue.module.css';

export function NextUpEmptyState() {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyText}>No actions right now</p>
      <p className={styles.emptyHint}>You&apos;re caught up. Start from Recent Stories below.</p>
      <Link href="/stories" className={styles.emptyLink}>Open Stories</Link>
    </div>
  );
}
