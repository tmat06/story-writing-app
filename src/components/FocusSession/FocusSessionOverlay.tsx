'use client';

import { useEffect, useRef } from 'react';
import type { FocusSession } from '@/types/session';
import type { Scene } from '@/types/scene';
import styles from './FocusSessionOverlay.module.css';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface FocusSessionOverlayProps {
  session: FocusSession;
  elapsedSeconds: number;
  isPaused: boolean;
  wordsAdded: number;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onToggleObjective: () => void;
  scenes: Scene[];
  currentSceneId: string | null;
}

export function FocusSessionOverlay({
  session,
  elapsedSeconds,
  isPaused,
  wordsAdded,
  onPause,
  onResume,
  onEnd,
  onToggleObjective,
  scenes: _scenes,
  currentSceneId,
}: FocusSessionOverlayProps) {
  const announced5minRef = useRef(false);
  const liveRef = useRef<HTMLSpanElement>(null);

  const hasTimer = session.timerPresetMinutes > 0;
  const totalSeconds = session.timerPresetMinutes * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

  // Auto-end when countdown hits zero
  useEffect(() => {
    if (hasTimer && remainingSeconds === 0 && !isPaused) {
      onEnd();
    }
  }, [hasTimer, remainingSeconds, isPaused, onEnd]);

  // Announce 5-min warning once
  useEffect(() => {
    if (hasTimer && remainingSeconds < 300 && !announced5minRef.current) {
      announced5minRef.current = true;
      if (liveRef.current) {
        liveRef.current.textContent = '5 minutes remaining';
      }
    }
  }, [hasTimer, remainingSeconds]);

  const displaySeconds = hasTimer ? remainingSeconds : elapsedSeconds;
  const isOffScene = currentSceneId !== null && currentSceneId !== session.sceneId;

  return (
    <div className={styles.overlay} role="region" aria-label="Focus session in progress">
      <span ref={liveRef} aria-live="polite" className={styles.srOnly} />

      <div className={styles.left}>
        <span className={styles.sceneName}>{session.sceneName}</span>
        <span className={styles.separator}>·</span>
        <span className={styles.objectiveText}>{session.objectiveText}</span>
        {isOffScene && (
          <span className={styles.offSceneNote}>
            Active session targets {session.sceneName}
          </span>
        )}
      </div>

      <div className={styles.center}>
        <span className={styles.timer} aria-label={hasTimer ? 'Time remaining' : 'Elapsed time'}>
          {formatTime(displaySeconds)}
        </span>
        <span className={styles.words}>+{wordsAdded} words</span>
      </div>

      <div className={styles.right}>
        <button
          className={`${styles.objectiveButton} ${session.objectiveStatus === 'complete' ? styles.objectiveComplete : ''}`}
          onClick={onToggleObjective}
          aria-pressed={session.objectiveStatus === 'complete'}
        >
          {session.objectiveStatus === 'complete' ? 'Complete' : 'In Progress'}
        </button>
        <button
          className={styles.controlButton}
          onClick={isPaused ? onResume : onPause}
          aria-label={isPaused ? 'Resume session' : 'Pause session'}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          className={styles.endButton}
          onClick={onEnd}
        >
          End Session
        </button>
      </div>
    </div>
  );
}
