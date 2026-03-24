'use client';
import styles from './Switch.module.css';

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-describedby'?: string;
}

export default function Switch({ id, checked, onChange, 'aria-describedby': ariaDescribedBy }: SwitchProps) {
  return (
    <span className={styles.track}>
      <input
        type="checkbox"
        id={id}
        className={styles.input}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={ariaDescribedBy}
      />
      <span className={styles.thumb} aria-hidden="true" />
    </span>
  );
}
