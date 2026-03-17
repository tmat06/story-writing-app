import styles from './CollabBadge.module.css';

interface CollabBadgeProps {
  count: number;
}

export function CollabBadge({ count }: CollabBadgeProps) {
  if (count === 0) return null;
  return (
    <span className={styles.badge} aria-label={`${count} unresolved`}>
      {count}
    </span>
  );
}
