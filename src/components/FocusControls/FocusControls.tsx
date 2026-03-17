'use client';

import type { TimerState } from '@/hooks/useSessionTimer';
import { formatDuration } from '@/hooks/useSessionTimer';
import type { SaveState } from '@/hooks/useAutosave';
import { formatRelativeTime } from '@/lib/autosave';
import styles from './FocusControls.module.css';

const TIMER_PRESETS = [
  { label: '15 min sprint', ms: 15 * 60 * 1000 },
  { label: '30 min sprint', ms: 30 * 60 * 1000 },
  { label: '45 min sprint', ms: 45 * 60 * 1000 },
];

interface FocusControlsProps {
  typewriterScroll: boolean;
  onToggleTypewriter: () => void;
  timerState: TimerState;
  elapsedMs: number;
  targetMs: number | null;
  onStartTimer: (durationMs: number) => void;
  onStopTimer: () => void;
  onDismissSummary: () => void;
  wordsWritten: number;
  onExitFocus: () => void;
  saveState: SaveState;
  lastSaved: number | null;
}

export function FocusControls({
  typewriterScroll,
  onToggleTypewriter,
  timerState,
  elapsedMs,
  targetMs,
  onStartTimer,
  onStopTimer,
  onDismissSummary,
  wordsWritten,
  onExitFocus,
  saveState,
  lastSaved,
}: FocusControlsProps) {
  const remaining = targetMs !== null ? Math.max(0, targetMs - elapsedMs) : null;

  return (
    <div className={styles.cluster} role="toolbar" aria-label="Focus mode controls">
      <button
        type="button"
        className={styles.exitBtn}
        onClick={onExitFocus}
        aria-label="Exit focus mode"
      >
        Exit focus
      </button>

      <button
        type="button"
        className={`${styles.toggleBtn} ${typewriterScroll ? styles.toggleActive : ''}`}
        onClick={onToggleTypewriter}
        aria-pressed={typewriterScroll}
        aria-label="Typewriter scroll"
      >
        Typewriter scroll
      </button>

      <div className={styles.timerSection}>
        {timerState === 'idle' && (
          <div className={styles.presets} aria-label="Timer presets">
            {TIMER_PRESETS.map((preset) => (
              <button
                key={preset.ms}
                type="button"
                className={styles.presetBtn}
                onClick={() => onStartTimer(preset.ms)}
                aria-label={`Start ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {timerState === 'running' && remaining !== null && (
          <div className={styles.timerRunning}>
            <span className={styles.timerDisplay} aria-live="off">
              {formatDuration(remaining)} left
            </span>
            <button
              type="button"
              className={styles.stopBtn}
              onClick={onStopTimer}
              aria-label="Stop timer"
            >
              Stop
            </button>
          </div>
        )}

        {timerState === 'complete' && (
          <div className={styles.summary} role="status" aria-live="polite">
            <span className={styles.summaryText}>
              Session complete &middot; {targetMs ? formatDuration(targetMs) : ''} &middot; {wordsWritten} word{wordsWritten !== 1 ? 's' : ''} written
            </span>
            <button
              type="button"
              className={styles.dismissBtn}
              onClick={onDismissSummary}
              aria-label="Dismiss session summary"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      <span className={styles.saveStatus} aria-live="polite">
        {saveState === 'saving' && 'Saving…'}
        {(saveState === 'saved' || (saveState === 'idle' && lastSaved)) && lastSaved &&
          `Saved ${formatRelativeTime(lastSaved)}`}
        {saveState === 'failed' && 'Save failed'}
        {saveState === 'idle' && !lastSaved && ''}
      </span>
    </div>
  );
}
