'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type TimerState = 'idle' | 'running' | 'complete';

export interface UseSessionTimerReturn {
  timerState: TimerState;
  elapsedMs: number;
  targetMs: number | null;
  startTimer: (durationMs: number, currentWordCount: number) => void;
  stopTimer: () => void;
  dismissSummary: () => void;
  wordsWritten: (currentWordCount: number) => number;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useSessionTimer(): UseSessionTimerReturn {
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [targetMs, setTargetMs] = useState<number | null>(null);
  const startWordCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimerInterval = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimer = useCallback((durationMs: number, currentWordCount: number) => {
    clearTimerInterval();
    startWordCountRef.current = currentWordCount;
    setElapsedMs(0);
    setTargetMs(durationMs);
    setTimerState('running');
  }, []);

  const stopTimer = useCallback(() => {
    clearTimerInterval();
    setTimerState('idle');
    setElapsedMs(0);
    setTargetMs(null);
  }, []);

  const dismissSummary = useCallback(() => {
    setTimerState('idle');
    setElapsedMs(0);
    setTargetMs(null);
  }, []);

  const wordsWritten = useCallback((currentWordCount: number) => {
    return Math.max(0, currentWordCount - startWordCountRef.current);
  }, []);

  // Tick: pure increment only
  useEffect(() => {
    if (timerState !== 'running') return;

    intervalRef.current = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + 1000;
        return targetMs !== null && next >= targetMs ? targetMs : next;
      });
    }, 1000);

    return () => clearTimerInterval();
  }, [timerState, targetMs]);

  // Completion: side effects isolated in their own effect
  useEffect(() => {
    if (timerState === 'running' && targetMs !== null && elapsedMs >= targetMs) {
      clearTimerInterval();
      setTimerState('complete');
      console.log('SessionTimer: completed', { duration: formatDuration(targetMs) });
    }
  }, [elapsedMs, timerState, targetMs]);

  return {
    timerState,
    elapsedMs,
    targetMs,
    startTimer,
    stopTimer,
    dismissSummary,
    wordsWritten,
  };
}
