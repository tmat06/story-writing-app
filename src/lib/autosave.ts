export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function contentKey(storyId: string) {
  return `story_${storyId}_content`;
}

function snapshotKey(storyId: string) {
  return `story_${storyId}_snapshot`;
}

function metadataKey(storyId: string) {
  return `story_${storyId}_metadata`;
}

export interface SaveMetadata {
  lastSaved: number | null;
  saveState: 'idle' | 'saving' | 'saved' | 'failed';
}

export interface Snapshot {
  content: string;
  timestamp: number;
}

export async function saveContent(storyId: string, content: string): Promise<void> {
  try {
    localStorage.setItem(contentKey(storyId), content);
    clearSnapshot(storyId);
    const meta: SaveMetadata = { lastSaved: Date.now(), saveState: 'saved' };
    localStorage.setItem(metadataKey(storyId), JSON.stringify(meta));
  } catch (err) {
    console.error(`Failed to save story ${storyId}:`, err);
    throw err;
  }
}

export function loadContent(storyId: string): string | null {
  try {
    return localStorage.getItem(contentKey(storyId));
  } catch {
    return null;
  }
}

export function saveSnapshot(storyId: string, content: string): void {
  try {
    const snap: Snapshot = { content, timestamp: Date.now() };
    localStorage.setItem(snapshotKey(storyId), JSON.stringify(snap));
  } catch {
    // Swallow snapshot errors — autosave is primary
  }
}

export function loadSnapshot(storyId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(storyId));
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export function clearSnapshot(storyId: string): void {
  try {
    localStorage.removeItem(snapshotKey(storyId));
  } catch {
    // ignore
  }
}

export function hasUnsavedChanges(storyId: string): boolean {
  try {
    const snap = loadSnapshot(storyId);
    if (!snap) return false;
    const meta = getSaveMetadata(storyId);
    if (!meta?.lastSaved) return true;
    return snap.timestamp > meta.lastSaved;
  } catch {
    return false;
  }
}

export function getSaveMetadata(storyId: string): SaveMetadata | null {
  try {
    const raw = localStorage.getItem(metadataKey(storyId));
    if (!raw) return null;
    return JSON.parse(raw) as SaveMetadata;
  } catch {
    return null;
  }
}

export function clearAutosaveData(storyId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(contentKey(storyId));
  localStorage.removeItem(snapshotKey(storyId));
  localStorage.removeItem(metadataKey(storyId));
}

export function formatRelativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
