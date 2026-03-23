export type ResumeState = {
  sceneId: string | null;
  cursorPosition: number;
  viewMode: string;
  savedAt: string;
};

const key = (storyId: string) => `story-${storyId}-resume-state`;
const optOutKey = (storyId: string) => `story-${storyId}-resume-optout`;

export function saveResumeState(storyId: string, state: ResumeState): void {
  try {
    localStorage.setItem(key(storyId), JSON.stringify(state));
  } catch {
    // Silently swallow QuotaExceededError and other storage errors
  }
}

export function loadResumeState(storyId: string): ResumeState | null {
  try {
    const raw = localStorage.getItem(key(storyId));
    if (!raw) return null;
    return JSON.parse(raw) as ResumeState;
  } catch {
    return null;
  }
}

export function clearResumeState(storyId: string): void {
  try {
    localStorage.removeItem(key(storyId));
  } catch {
    // Silently swallow storage errors
  }
}

export function clearResumeStateData(storyId: string): void {
  try {
    localStorage.removeItem(key(storyId));
    localStorage.removeItem(optOutKey(storyId));
  } catch {
    // Silently swallow storage errors
  }
}

export function getResumeOptOut(storyId: string): boolean {
  try {
    const raw = localStorage.getItem(optOutKey(storyId));
    if (!raw) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function setResumeOptOut(storyId: string, value: boolean): void {
  try {
    localStorage.setItem(optOutKey(storyId), JSON.stringify(value));
  } catch {
    // Silently swallow storage errors
  }
}

export function resolveSceneId(
  savedSceneId: string | null,
  availableSceneIds: string[]
): string | null {
  if (!savedSceneId) return null;
  return availableSceneIds.includes(savedSceneId) ? savedSceneId : null;
}

export function clampCursor(savedPos: number, contentLength: number): number {
  return Math.min(Math.max(0, savedPos), contentLength);
}
