import type { FocusSession, ActiveSessionState } from '@/types/session';

const MAX_SESSIONS = 20;

function sessionsKey(storyId: string): string {
  return `story-${storyId}-sessions`;
}

function activeSessionKey(storyId: string): string {
  return `story-${storyId}-active-session`;
}

export function getSessions(storyId: string): FocusSession[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(sessionsKey(storyId));
  if (!stored) return [];
  try {
    const sessions = JSON.parse(stored) as FocusSession[];
    return sessions
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

export function saveSession(session: FocusSession): void {
  if (typeof window === 'undefined') return;
  const sessions = getSessions(session.storyId);
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  const trimmed = sessions.slice(0, MAX_SESSIONS);
  localStorage.setItem(sessionsKey(session.storyId), JSON.stringify(trimmed));
}

export function getActiveSessionState(storyId: string): ActiveSessionState | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(activeSessionKey(storyId));
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ActiveSessionState;
  } catch {
    return null;
  }
}

export function saveActiveSessionState(storyId: string, state: ActiveSessionState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(activeSessionKey(storyId), JSON.stringify(state));
}

export function clearActiveSessionState(storyId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(activeSessionKey(storyId));
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
