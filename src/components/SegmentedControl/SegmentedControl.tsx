'use client';
import styles from './SegmentedControl.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-labelledby'?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-labelledby': ariaLabelledBy,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-labelledby={ariaLabelledBy} className={styles.container}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.segment}${value === option.value ? ` ${styles.segmentActive}` : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
