import { Tooltip } from '@/components/Tooltip/Tooltip';
import styles from './ViewModeSwitch.module.css';

export type ViewMode = 'editor' | 'corkboard' | 'submissions' | 'pacing' | 'diagnostics';

interface ViewModeSwitchProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  compact?: boolean;
}

export function ViewModeSwitch({ mode, onChange, compact }: ViewModeSwitchProps) {
  return (
    <div
      className={`${styles.container}${compact ? ` ${styles.compact}` : ''}`}
      role="toolbar"
      aria-label="View mode selector"
    >
      <Tooltip content="Write and edit your story prose.">
        <button
          type="button"
          className={mode === 'editor' ? styles.active : styles.inactive}
          onClick={() => onChange('editor')}
          aria-label="Switch to editor view"
          aria-pressed={mode === 'editor'}
        >
          {compact ? 'Write' : 'Editor'}
        </button>
      </Tooltip>
      <Tooltip content="Plan and rearrange scenes on a visual board.">
        <button
          type="button"
          className={mode === 'corkboard' ? styles.active : styles.inactive}
          onClick={() => onChange('corkboard')}
          aria-label="Switch to corkboard view"
          aria-pressed={mode === 'corkboard'}
        >
          {compact ? 'Board' : 'Corkboard'}
        </button>
      </Tooltip>
      <Tooltip content="Track your story's query and submission history.">
        <button
          type="button"
          className={mode === 'submissions' ? styles.active : styles.inactive}
          onClick={() => onChange('submissions')}
          aria-label="Switch to submissions view"
          aria-pressed={mode === 'submissions'}
        >
          {compact ? 'Subs' : 'Submissions'}
        </button>
      </Tooltip>
      <Tooltip content="Visualize the tension and word count arc across your story.">
        <button
          type="button"
          className={mode === 'pacing' ? styles.active : styles.inactive}
          onClick={() => onChange('pacing')}
          aria-label="Switch to pacing view"
          aria-pressed={mode === 'pacing'}
        >
          {compact ? 'Pacing' : 'Pacing'}
        </button>
      </Tooltip>
      <Tooltip content="Spot POV and character-balance issues across your manuscript.">
        <button
          type="button"
          className={mode === 'diagnostics' ? styles.active : styles.inactive}
          onClick={() => onChange('diagnostics')}
          aria-label="Switch to diagnostics view"
          aria-pressed={mode === 'diagnostics'}
        >
          {compact ? 'Diag' : 'Diagnostics'}
        </button>
      </Tooltip>
    </div>
  );
}
