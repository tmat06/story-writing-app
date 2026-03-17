import { saveSnapshot } from '@/lib/autosave';

export interface VersionEntry {
  id: string;
  content: string;
  timestamp: number;
  label: string | null;
  type: 'auto' | 'named';
  wordCount: number;
}

function countWords(content: string): number {
  return content.split(/\s+/).filter((s) => s.length > 0).length;
}

function versionsKey(storyId: string) {
  return `story_${storyId}_versions`;
}

export function getVersions(storyId: string): VersionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(versionsKey(storyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VersionEntry[];
    // Named first (timestamp desc), then auto (timestamp desc)
    const named = parsed.filter((v) => v.type === 'named').sort((a, b) => b.timestamp - a.timestamp);
    const auto = parsed.filter((v) => v.type === 'auto').sort((a, b) => b.timestamp - a.timestamp);
    return [...named, ...auto];
  } catch {
    return [];
  }
}

function saveVersions(storyId: string, versions: VersionEntry[]): void {
  try {
    localStorage.setItem(versionsKey(storyId), JSON.stringify(versions));
  } catch {
    // Swallow write errors — same defensive pattern as saveSnapshot
  }
}

function enforceRetention(versions: VersionEntry[]): VersionEntry[] {
  const named = versions.filter((v) => v.type === 'named');
  const auto = versions.filter((v) => v.type === 'auto').sort((a, b) => b.timestamp - a.timestamp);
  const dropped = auto.length > 50 ? auto.length - 50 : 0;
  if (dropped > 0) {
    console.log(`Retention: dropped ${dropped} auto-checkpoints`);
  }
  const trimmedAuto = auto.slice(0, 50);
  const named2 = named.sort((a, b) => b.timestamp - a.timestamp);
  return [...named2, ...trimmedAuto];
}

export function addAutoCheckpoint(storyId: string, content: string): VersionEntry | null {
  try {
    const existing = getVersions(storyId);
    const lastAuto = existing.filter((v) => v.type === 'auto').sort((a, b) => b.timestamp - a.timestamp)[0];
    if (lastAuto && lastAuto.content === content) {
      return null; // no-op
    }
    const entry: VersionEntry = {
      id: crypto.randomUUID(),
      content,
      timestamp: Date.now(),
      label: null,
      type: 'auto',
      wordCount: countWords(content),
    };
    const updated = enforceRetention([...existing, entry]);
    saveVersions(storyId, updated);
    console.log(`Auto-checkpoint saved for story ${storyId} (total: ${updated.length})`);
    return entry;
  } catch (err) {
    console.error(`Failed to save auto-checkpoint for story ${storyId}:`, err);
    throw err;
  }
}

export function addNamedVersion(storyId: string, content: string, label: string): VersionEntry {
  const existing = getVersions(storyId);
  const entry: VersionEntry = {
    id: crypto.randomUUID(),
    content,
    timestamp: Date.now(),
    label: label.trim(),
    type: 'named',
    wordCount: countWords(content),
  };
  const updated = enforceRetention([...existing, entry]);
  saveVersions(storyId, updated);
  console.log(`Named draft '${label}' saved for story ${storyId}`);
  return entry;
}

export function restoreVersion(
  storyId: string,
  versionId: string,
  currentContent: string
): VersionEntry | null {
  // Safety snapshot first
  saveSnapshot(storyId, currentContent);
  // Checkpoint of current state before overwriting
  try {
    addAutoCheckpoint(storyId, currentContent);
  } catch {
    // Best-effort
  }
  const versions = getVersions(storyId);
  const entry = versions.find((v) => v.id === versionId) ?? null;
  if (entry) {
    console.log(`Restoring story ${storyId} to version ${versionId} (timestamp: ${entry.timestamp})`);
  }
  return entry;
}
