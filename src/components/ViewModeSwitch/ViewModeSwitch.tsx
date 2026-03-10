import styles from './ViewModeSwitch.module.css';

export type ViewMode = 'editor' | 'corkboard';

interface ViewModeSwitchProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeSwitch({ mode, onChange }: ViewModeSwitchProps) {
  return (
    <div
      className={styles.container}
      role="toolbar"
      aria-label="View mode selector"
    >
      <button
        type="button"
        className={mode === 'editor' ? styles.active : styles.inactive}
        onClick={() => onChange('editor')}
        aria-label="Switch to editor view"
        aria-pressed={mode === 'editor'}
      >
        Editor
      </button>
      <button
        type="button"
        className={mode === 'corkboard' ? styles.active : styles.inactive}
        onClick={() => onChange('corkboard')}
        aria-label="Switch to corkboard view"
        aria-pressed={mode === 'corkboard'}
      >
        Corkboard
      </button>
    </div>
  );
}
