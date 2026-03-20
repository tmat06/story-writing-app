import styles from './KpiStrip.module.css';

interface KpiStripProps {
  povBalanceStatus: 'ok' | 'warn' | 'alert';
  absentCharactersCount: number;
  activeWarningsCount: number;
}

export function KpiStrip({ povBalanceStatus, absentCharactersCount, activeWarningsCount }: KpiStripProps) {
  const povLabel =
    povBalanceStatus === 'ok'
      ? 'Balanced'
      : povBalanceStatus === 'warn'
      ? 'Imbalance'
      : 'Severe Imbalance';

  return (
    <div className={styles.strip}>
      <div className={`${styles.card} ${styles[`card--${povBalanceStatus}`]}`}>
        <span className={styles.label}>POV Balance</span>
        <span className={styles.value}>{povLabel}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.label}>Absent Characters</span>
        <span className={styles.value}>{absentCharactersCount} character{absentCharactersCount !== 1 ? 's' : ''} absent</span>
      </div>
      <div className={styles.card}>
        <span className={styles.label}>Active Warnings</span>
        <span className={styles.value}>{activeWarningsCount} active warning{activeWarningsCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
