'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  saveContent,
  loadContent,
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
  hasUnsavedChanges,
  getSaveMetadata,
  debounce,
} from '@/lib/autosave';
import { touchStory } from '@/lib/stories';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

interface UseAutosaveResult {
  content: string;
  setContent: (newContent: string) => void;
  saveState: SaveState;
  lastSaved: number | null;
  error: string | null;
  retrySave: () => Promise<void>;
  restoreSnapshot: () => void;
  hasRecovery: boolean;
}

export function useAutosave(storyId: string, initialContent?: string): UseAutosaveResult {
  const [content, setContentState] = useState<string>(() => {
    if (typeof window === 'undefined') return initialContent ?? '';
    const saved = loadContent(storyId);
    return saved ?? initialContent ?? '';
  });

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSaved, setLastSaved] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    return getSaveMetadata(storyId)?.lastSaved ?? null;
  });
  const [error, setError] = useState<string | null>(null);
  const [hasRecovery, setHasRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return hasUnsavedChanges(storyId);
  });

  const contentRef = useRef(content);
  contentRef.current = content;

  const performSave = useCallback(async (text: string) => {
    setSaveState('saving');
    setError(null);
    try {
      await saveContent(storyId, text);
      touchStory(storyId);
      setSaveState('saved');
      setLastSaved(Date.now());
      setHasRecovery(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveState('failed');
      setError(message);
    }
  }, [storyId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((text: string) => {
      performSave(text);
    }, 2000),
    [performSave]
  );

  const setContent = useCallback((newContent: string) => {
    setContentState(newContent);
    // Synchronous snapshot for crash protection
    saveSnapshot(storyId, newContent);
    // Debounced autosave
    debouncedSave(newContent);
  }, [storyId, debouncedSave]);

  const retrySave = useCallback(async () => {
    await performSave(contentRef.current);
  }, [performSave]);

  const restoreSnapshot = useCallback(() => {
    const snap = loadSnapshot(storyId);
    if (snap) {
      setContentState(snap.content);
      setHasRecovery(false);
    }
  }, [storyId]);

  // beforeunload: final save attempt
  useEffect(() => {
    const handler = () => {
      saveSnapshot(storyId, contentRef.current);
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [storyId]);

  return {
    content,
    setContent,
    saveState,
    lastSaved,
    error,
    retrySave,
    restoreSnapshot,
    hasRecovery,
  };
}
