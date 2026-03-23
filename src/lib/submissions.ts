import type { SubmissionEntry, SubmissionStatus, ReminderStatus, ReminderLogEntry } from '@/types/submission';

function storageKey(storyId: string): string {
  return `story-${storyId}-submissions`;
}

/**
 * Normalize a raw entry from localStorage, filling in missing reminder fields.
 */
function normalizeEntry(raw: unknown): SubmissionEntry {
  const e = raw as unknown as SubmissionEntry & Record<string, unknown>;
  return {
    ...e,
    followUpAfterDays: (e.followUpAfterDays as number | null) ?? null,
    expectedResponseWindowDays: (e.expectedResponseWindowDays as number | null) ?? null,
    snoozedUntil: (e.snoozedUntil as string | null) ?? null,
    reminderDismissed: (e.reminderDismissed as boolean) ?? false,
    reminderLog: (e.reminderLog as ReminderLogEntry[]) ?? [],
  };
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
      const entries = JSON.parse(stored) as unknown[];
      return entries
        .map(normalizeEntry)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

/**
 * Helper: is a given ISO date string in the past (before today)?
 */
export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

/** Pure date arithmetic: add `days` to an ISO date string, returns ISO date string (YYYY-MM-DD). */
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the reminder urgency status for a submission entry.
 */
export function computeReminderStatus(entry: SubmissionEntry): ReminderStatus {
  if (
    entry.archivedAt ||
    entry.status === 'closed' ||
    entry.reminderDismissed ||
    !entry.sentDate
  ) {
    return 'none';
  }

  const today = new Date().toISOString().slice(0, 10);

  if (entry.snoozedUntil && today < entry.snoozedUntil) {
    return 'none';
  }

  const sentDate = entry.sentDate.slice(0, 10);
  const followUpDue = addDays(sentDate, entry.followUpAfterDays ?? 14);
  const overdueBoundary = entry.expectedResponseWindowDays
    ? addDays(sentDate, entry.expectedResponseWindowDays)
    : addDays(followUpDue, 14);

  if (today > overdueBoundary) return 'overdue';
  if (today >= followUpDue) return 'follow_up_due';
  return 'on_track';
}

/**
 * Mark a submission as followed up. Appends a log entry and resets snooze/dismiss.
 */
export function markFollowedUp(storyId: string, id: string): void {
  const entries = getSubmissions(storyId);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  updateSubmission(storyId, id, {
    snoozedUntil: null,
    reminderDismissed: false,
    reminderLog: [
      ...entry.reminderLog,
      { at: new Date().toISOString(), action: 'followed_up' },
    ],
  });
}

/**
 * Snooze a submission reminder for the given number of days.
 */
export function snoozeReminder(storyId: string, id: string, days = 7): void {
  const entries = getSubmissions(storyId);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  const snoozedUntil = addDays(new Date().toISOString().slice(0, 10), days);
  updateSubmission(storyId, id, {
    snoozedUntil,
    reminderLog: [
      ...entry.reminderLog,
      { at: new Date().toISOString(), action: 'snoozed', note: `${days}d` },
    ],
  });
}

/**
 * Permanently dismiss the reminder for a submission.
 */
export function dismissReminder(storyId: string, id: string): void {
  const entries = getSubmissions(storyId);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  updateSubmission(storyId, id, {
    reminderDismissed: true,
    reminderLog: [
      ...entry.reminderLog,
      { at: new Date().toISOString(), action: 'dismissed' },
    ],
  });
}

/**
 * Get all submissions across all stories (for Home digest).
 * Iterates localStorage keys matching `story-*-submissions`.
 */
export function getAllSubmissionsAcrossStories(): SubmissionEntry[] {
  if (typeof window === 'undefined') return [];
  const all: SubmissionEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !/^story-.+-submissions$/.test(key)) continue;
    const stored = localStorage.getItem(key);
    if (!stored) continue;
    try {
      const entries = JSON.parse(stored) as unknown[];
      all.push(...entries.map(normalizeEntry));
    } catch {
      // skip corrupt keys
    }
  }
  return all;
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
