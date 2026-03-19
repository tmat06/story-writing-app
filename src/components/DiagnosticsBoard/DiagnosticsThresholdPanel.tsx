import { useState } from 'react';
import type { DiagnosticThresholds } from '@/types/diagnostics';
import styles from './DiagnosticsThresholdPanel.module.css';

interface DiagnosticsThresholdPanelProps {
  thresholds: DiagnosticThresholds;
  onChange: (t: DiagnosticThresholds) => void;
}

export function DiagnosticsThresholdPanel({ thresholds, onChange }: DiagnosticsThresholdPanelProps) {
  const [updated, setUpdated] = useState(false);

  function handleChange(partial: Partial<DiagnosticThresholds>) {
    onChange({ ...thresholds, ...partial });
    setUpdated(true);
    setTimeout(() => setUpdated(false), 2000);
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>Thresholds</h3>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pov-dominance-pct">
          Flag POV dominance above {thresholds.povDominancePct}% of chapter scenes
        </label>
        <input
          id="pov-dominance-pct"
          type="number"
          min={50}
          max={100}
          step={5}
          value={thresholds.povDominancePct}
          className={styles.input}
          onChange={(e) => handleChange({ povDominancePct: Number(e.target.value) })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="char-absence-chapters">
          Flag character absent for {thresholds.characterAbsenceChapters}+ chapters
        </label>
        <input
          id="char-absence-chapters"
          type="number"
          min={1}
          max={10}
          step={1}
          value={thresholds.characterAbsenceChapters}
          className={styles.input}
          onChange={(e) => handleChange({ characterAbsenceChapters: Number(e.target.value) })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="snooze-duration">
          Snooze duration
        </label>
        <select
          id="snooze-duration"
          className={styles.input}
          value={thresholds.snoozeHours}
          onChange={(e) => handleChange({ snoozeHours: Number(e.target.value) })}
        >
          <option value={12}>12 hours</option>
          <option value={24}>24 hours</option>
          <option value={48}>48 hours</option>
          <option value={72}>72 hours</option>
          <option value={168}>1 week</option>
        </select>
      </div>
      <span aria-live="polite" className={styles.confirmation}>
        {updated ? 'Thresholds updated' : ''}
      </span>
    </div>
  );
}
