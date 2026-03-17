'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FocusSession, ObjectiveType, ObjectiveStatus, ActiveSessionState } from '@/types/session';
import type { Scene } from '@/types/scene';
import {
  getSessions,
  saveSession,
  getActiveSessionState,
  saveActiveSessionState,
  clearActiveSessionState,
  countWords,
} from '@/lib/sessions';

interface UseFocusSessionProps {
  storyId: string;
  currentContent: string;
  currentSceneId: string | null;
  scenes: Scene[];
}

interface StartSessionConfig {
  sceneId: string;
  sceneName: string;
  objectiveType: ObjectiveType;
  objectiveText: string;
  timerPresetMinutes: number;
  wordsAtStart: number;
}

interface UseFocusSessionReturn {
  setupOpen: boolean;
  activeSession: FocusSession | null;
  recapSession: FocusSession | null;
  elapsedSeconds: number;
  isPaused: boolean;
  wordsAdded: number;
  openSetup: () => void;
  closeSetup: () => void;
  startSession: (config: StartSessionConfig) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  toggleObjectiveStatus: () => void;
  endSession: () => void;
  saveRecap: (handoffNote: string, nextSceneId: string | null, objectiveStatus: ObjectiveStatus) => void;
}

export function useFocusSession({
  storyId,
  currentContent,
  currentSceneId,
  scenes,
}: UseFocusSessionProps): UseFocusSessionReturn {
  const [setupOpen, setSetupOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [recapSession, setRecapSession] = useState<FocusSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: restore active session from localStorage
  useEffect(() => {
    const state = getActiveSessionState(storyId);
    if (!state) return;
    const sessions = getSessions(storyId);
    const session = sessions.find((s) => s.id === state.sessionId && s.endedAt === null);
    if (session) {
      setActiveSession(session);
      setElapsedSeconds(state.elapsedSeconds);
      setIsPaused(state.isPaused);
    } else {
      clearActiveSessionState(storyId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  // Timer tick
  useEffect(() => {
    if (activeSession && !isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          saveActiveSessionState(storyId, {
            sessionId: activeSession.id,
            elapsedSeconds: next,
            isPaused: false,
            wordsAtStart: activeSession.wordsAtStart,
          });
          return next;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeSession, isPaused, storyId]);

  const wordsAdded = Math.max(
    0,
    countWords(currentContent) - (activeSession?.wordsAtStart ?? 0)
  );

  const openSetup = useCallback(() => setSetupOpen(true), []);
  const closeSetup = useCallback(() => setSetupOpen(false), []);

  const startSession = useCallback(
    (config: StartSessionConfig) => {
      const session: FocusSession = {
        id: crypto.randomUUID(),
        storyId,
        sceneId: config.sceneId,
        sceneName: config.sceneName,
        objectiveType: config.objectiveType,
        objectiveText: config.objectiveText,
        startedAt: Date.now(),
        endedAt: null,
        timerPresetMinutes: config.timerPresetMinutes,
        wordsAtStart: config.wordsAtStart,
        wordsAtEnd: null,
        objectiveStatus: 'in-progress',
        handoffNote: '',
        nextSceneId: null,
      };
      console.log(`Focus session started: ${session.id}, sceneId: ${session.sceneId}`);
      saveSession(session);
      saveActiveSessionState(storyId, {
        sessionId: session.id,
        elapsedSeconds: 0,
        isPaused: false,
        wordsAtStart: config.wordsAtStart,
      });
      setActiveSession(session);
      setElapsedSeconds(0);
      setIsPaused(false);
      setSetupOpen(false);
    },
    [storyId]
  );

  const pauseSession = useCallback(() => {
    if (!activeSession) return;
    setIsPaused(true);
    saveActiveSessionState(storyId, {
      sessionId: activeSession.id,
      elapsedSeconds,
      isPaused: true,
      wordsAtStart: activeSession.wordsAtStart,
    });
  }, [activeSession, elapsedSeconds, storyId]);

  const resumeSession = useCallback(() => {
    if (!activeSession) return;
    setIsPaused(false);
    saveActiveSessionState(storyId, {
      sessionId: activeSession.id,
      elapsedSeconds,
      isPaused: false,
      wordsAtStart: activeSession.wordsAtStart,
    });
  }, [activeSession, elapsedSeconds, storyId]);

  const toggleObjectiveStatus = useCallback(() => {
    if (!activeSession) return;
    const next: ObjectiveStatus =
      activeSession.objectiveStatus === 'in-progress' ? 'complete' : 'in-progress';
    const updated = { ...activeSession, objectiveStatus: next };
    setActiveSession(updated);
    saveSession(updated);
  }, [activeSession]);

  const endSession = useCallback(() => {
    if (!activeSession) return;
    const wordsAtEnd = countWords(currentContent);
    const ended: FocusSession = {
      ...activeSession,
      endedAt: Date.now(),
      wordsAtEnd,
    };
    console.log(`Focus session ended: ${ended.id}, words added: ${wordsAtEnd - ended.wordsAtStart}`);
    clearActiveSessionState(storyId);
    setActiveSession(null);
    setRecapSession(ended);
  }, [activeSession, currentContent, storyId]);

  const saveRecap = useCallback(
    (handoffNote: string, nextSceneId: string | null, objectiveStatus: ObjectiveStatus) => {
      if (!recapSession) return;
      const finalized: FocusSession = {
        ...recapSession,
        handoffNote,
        nextSceneId,
        objectiveStatus,
      };
      saveSession(finalized);
      setRecapSession(null);
    },
    [recapSession]
  );

  // scenes is used for context — suppress unused warning
  void scenes;
  void currentSceneId;

  return {
    setupOpen,
    activeSession,
    recapSession,
    elapsedSeconds,
    isPaused,
    wordsAdded,
    openSetup,
    closeSetup,
    startSession,
    pauseSession,
    resumeSession,
    toggleObjectiveStatus,
    endSession,
    saveRecap,
  };
}
