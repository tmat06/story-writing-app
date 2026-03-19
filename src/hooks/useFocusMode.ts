'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface FocusPrefs {
  typewriterScroll: boolean;
}

function loadPrefs(): FocusPrefs {
  try {
    const raw = localStorage.getItem('focus_prefs');
    if (raw) return JSON.parse(raw) as FocusPrefs;
  } catch {
    // ignore
  }
  return { typewriterScroll: false };
}

function savePrefs(prefs: FocusPrefs) {
  try {
    localStorage.setItem('focus_prefs', JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export interface UseFocusModeReturn {
  isFocusMode: boolean;
  typewriterScroll: boolean;
  enterFocus: () => void;
  exitFocus: () => void;
  toggleTypewriter: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useFocusMode(): UseFocusModeReturn {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [typewriterScroll, setTypewriterScroll] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load persisted prefs on mount
  useEffect(() => {
    const prefs = loadPrefs();
    setTypewriterScroll(prefs.typewriterScroll);
  }, []);

  const enterFocus = useCallback(() => {
    setIsFocusMode(true);
  }, []);

  const exitFocus = useCallback(() => {
    setIsFocusMode(false);
  }, []);

  const toggleTypewriter = useCallback(() => {
    setTypewriterScroll((prev) => {
      const next = !prev;
      savePrefs({ typewriterScroll: next });
      return next;
    });
  }, []);

  // Escape key to exit focus mode
  useEffect(() => {
    if (!isFocusMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFocus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isFocusMode, exitFocus]);

  // Typewriter scroll: keep cursor ~30% from top of textarea viewport
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !typewriterScroll || !isFocusMode) return;

    const handleInput = () => {
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
      const viewportHeight = textarea.clientHeight;
      const targetOffset = viewportHeight * 0.3;

      // Estimate cursor line position from caret
      const before = textarea.value.substring(0, textarea.selectionStart);
      const lines = before.split('\n').length;
      const cursorTop = (lines - 1) * lineHeight;

      // Only scroll if content exceeds viewport
      if (textarea.scrollHeight > viewportHeight) {
        textarea.scrollTop = Math.max(0, cursorTop - targetOffset);
      }
    };

    textarea.addEventListener('input', handleInput);
    return () => textarea.removeEventListener('input', handleInput);
  }, [typewriterScroll, isFocusMode]);

  return { isFocusMode, typewriterScroll, enterFocus, exitFocus, toggleTypewriter, textareaRef };
}
