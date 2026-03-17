import styles from './CollabPanel.module.css';

interface Props {
  count: number;
}

export function CollabBadge({ count }: Props) {
  if (count === 0) return null;
  return (
    <span className={styles.badge} aria-label={`${count} unresolved collaboration thread${count === 1 ? '' : 's'}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
