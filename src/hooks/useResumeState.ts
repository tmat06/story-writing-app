'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  saveResumeState,
  loadResumeState,
  getResumeOptOut,
  setResumeOptOut,
  type ResumeState,
} from '@/lib/resumeState';

export function useResumeState(storyId: string) {
  const [optOut, setOptOutState] = useState(() => getResumeOptOut(storyId));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const loadRestore = useCallback((): {
    sceneId: string | null;
    cursorPosition: number;
    viewMode: string;
  } | null => {
    if (getResumeOptOut(storyId)) return null;
    const state = loadResumeState(storyId);
    if (!state) return null;
    return {
      sceneId: state.sceneId,
      cursorPosition: state.cursorPosition,
      viewMode: state.viewMode,
    };
  }, [storyId]);

  const scheduleUpdate = useCallback(
    (state: Omit<ResumeState, 'savedAt'>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveResumeState(storyId, { ...state, savedAt: new Date().toISOString() });
      }, 1500);
    },
    [storyId]
  );

  const setOptOut = useCallback(
    (value: boolean) => {
      setResumeOptOut(storyId, value);
      setOptOutState(value);
    },
    [storyId]
  );

  return { loadRestore, scheduleUpdate, optOut, setOptOut };
}
