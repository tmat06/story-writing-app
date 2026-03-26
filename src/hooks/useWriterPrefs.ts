'use client';
import { useState, useEffect, useCallback } from 'react';

export interface WriterPrefs {
  fontSize: '14px' | '16px' | '18px' | '20px' | '22px';
  lineHeight: '1.5' | '1.75' | '2.0';
  editorWidth: '60ch' | '72ch' | '80ch' | '90ch';
  focusByDefault: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

export const WRITER_PREFS_DEFAULTS: WriterPrefs = {
  fontSize: '18px',
  lineHeight: '1.75',
  editorWidth: '72ch',
  focusByDefault: false,
  highContrast: false,
  reducedMotion: false,
};

const STORAGE_KEY = 'writer_prefs';

function loadPrefs(): WriterPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...WRITER_PREFS_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...WRITER_PREFS_DEFAULTS };
}

function persistPrefs(prefs: WriterPrefs): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

export type SaveStatus = 'idle' | 'saved' | 'error';

export interface UseWriterPrefsReturn {
  prefs: WriterPrefs;
  updatePref: <K extends keyof WriterPrefs>(key: K, value: WriterPrefs[K]) => void;
  resetPrefs: () => void;
  saveStatus: SaveStatus;
}

export function useWriterPrefs(): UseWriterPrefsReturn {
  const [prefs, setPrefs] = useState<WriterPrefs>(WRITER_PREFS_DEFAULTS);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const updatePref = useCallback(<K extends keyof WriterPrefs>(
    key: K,
    value: WriterPrefs[K]
  ) => {
    const next = { ...prefs, [key]: value };
    const ok = persistPrefs(next);
    setPrefs(next);
    setSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [prefs]);

  const resetPrefs = useCallback(() => {
    const defaults = { ...WRITER_PREFS_DEFAULTS };
    const ok = persistPrefs(defaults);
    setPrefs(defaults);
    setSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  return { prefs, updatePref, resetPrefs, saveStatus };
}
