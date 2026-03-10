import styles from './MetadataRow.module.css';

interface MetadataRowProps {
  pov?: string;
  location?: string;
  timeframe?: string;
  onChange: (field: 'pov' | 'location' | 'timeframe', value: string) => void;
  readOnly?: boolean;
}

export function MetadataRow({
  pov = '',
  location = '',
  timeframe = '',
  onChange,
  readOnly = false,
}: MetadataRowProps) {
  return (
    <div className={styles.row} aria-label="Scene metadata">
      <div className={styles.field}>
        <label htmlFor="meta-pov" className={styles.label}>POV</label>
        <input
          id="meta-pov"
          type="text"
          className={styles.input}
          value={pov}
          placeholder="Add POV"
          readOnly={readOnly}
          onChange={(e) => onChange('pov', e.target.value)}
          aria-label="Point of view character"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="meta-location" className={styles.label}>Location</label>
        <input
          id="meta-location"
          type="text"
          className={styles.input}
          value={location}
          placeholder="Add location"
          readOnly={readOnly}
          onChange={(e) => onChange('location', e.target.value)}
          aria-label="Scene location"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="meta-timeframe" className={styles.label}>Timeframe</label>
        <input
          id="meta-timeframe"
          type="text"
          className={styles.input}
          value={timeframe}
          placeholder="Add timeframe"
          readOnly={readOnly}
          onChange={(e) => onChange('timeframe', e.target.value)}
          aria-label="Scene timeframe"
        />
      </div>
    </div>
  );
}
