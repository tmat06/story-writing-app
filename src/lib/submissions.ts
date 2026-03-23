import type { SubmissionEntry, SubmissionStatus } from '@/types/submission';

function storageKey(storyId: string): string {
  return `story-${storyId}-submissions`;
}

/**
 * Get all submission entries for a story.
 * Returns empty array on first call and seeds localStorage.
 */
export function getSubmissions(storyId: string): SubmissionEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const stored = localStorage.getItem(storageKey(storyId));

  if (stored) {
    try {
      const entries = JSON.parse(stored) as SubmissionEntry[];
      return entries.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('Failed to parse stored submissions:', error);
    }
  }

  localStorage.setItem(storageKey(storyId), JSON.stringify([]));
  return [];
}

/**
 * Add a new submission entry.
 */
export function addSubmission(
  storyId: string,
  fields: Omit<SubmissionEntry, 'id' | 'storyId' | 'createdAt' | 'updatedAt'>
): SubmissionEntry {
  const now = new Date().toISOString();
  const entry: SubmissionEntry = {
    ...fields,
    id: crypto.randomUUID(),
    storyId,
    createdAt: now,
    updatedAt: now,
  };

  const entries = getSubmissions(storyId);
  entries.unshift(entry);
  localStorage.setItem(storageKey(storyId), JSON.stringify(entries));
  return entry;
}

/**
 * Update an existing submission entry.
 */
export function updateSubmission(
  storyId: string,
  id: string,
  partial: Partial<Omit<SubmissionEntry, 'id' | 'storyId' | 'createdAt'>>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const entries = getSubmissions(storyId);
  const index = entries.findIndex((e) => e.id === id);

  if (index === -1) {
    console.error(`Submission ${id} not found`);
    return;
  }

  entries[index] = {
    ...entries[index],
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(storageKey(storyId), JSON.stringify(entries));
}

/**
 * Upsert a full SubmissionEntry (insert if new, replace if existing).
 * Used by the panel which constructs the full entry before saving.
 */
export function upsertSubmission(storyId: string, entry: SubmissionEntry): void {
  if (typeof window === 'undefined') {
    return;
  }

  const entries = getSubmissions(storyId);
  const index = entries.findIndex((e) => e.id === entry.id);

  if (index === -1) {
    entries.unshift(entry);
  } else {
    entries[index] = entry;
  }

  localStorage.setItem(storageKey(storyId), JSON.stringify(entries));
}

/**
 * Archive a submission entry (soft delete).
 */
export function archiveSubmission(storyId: string, id: string): void {
  updateSubmission(storyId, id, { archivedAt: new Date().toISOString() });
}

/**
 * Hard delete a submission entry.
 */
export function deleteSubmission(storyId: string, id: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const entries = getSubmissions(storyId);
  const filtered = entries.filter((e) => e.id !== id);
  localStorage.setItem(storageKey(storyId), JSON.stringify(filtered));
}

export function clearSubmissionsData(storyId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey(storyId));
}

/**
 * Helper: is a given ISO date string in the past (before today)?
 */
export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

/**
 * Human-readable labels for submission statuses.
 */
export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  drafting: 'Drafting',
  submitted: 'Submitted',
  requested_revisions: 'Requested Revisions',
  closed: 'Closed',
};
