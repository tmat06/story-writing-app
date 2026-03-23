/**
 * Submission status lifecycle states
 */
export type SubmissionStatus = 'drafting' | 'submitted' | 'requested_revisions' | 'closed';

/**
 * Response type from recipient
 */
export type ResponseType =
  | 'full_request'
  | 'partial_request'
  | 'rejection'
  | 'no_response'
  | 'offer'
  | 'other';

/**
 * A single reminder log entry recording a follow-up action.
 */
export interface ReminderLogEntry {
  at: string;
  action: 'followed_up' | 'snoozed' | 'dismissed';
  note?: string;
}

/**
 * Computed reminder urgency status for a submission entry.
 * 'none' means no actionable reminder (dismissed, snoozed, no sentDate, closed, etc.)
 */
export type ReminderStatus = 'on_track' | 'follow_up_due' | 'overdue' | 'none';

/**
 * A single submission entry tied to a manuscript
 */
export interface SubmissionEntry {
  /** Unique identifier */
  id: string;
  /** The story/manuscript this submission belongs to */
  storyId: string;
  /** Agent, contest, or beta reader name */
  recipientName: string;
  /** e.g. "Agent Query", "Contest", "Beta Reader" */
  channelType: string;
  /** Current pipeline status */
  status: SubmissionStatus;
  /** ISO date string of when submission was sent */
  sentDate: string | null;
  /** ISO date string of when response was received */
  responseDate: string | null;
  /** Type of response received */
  responseType: ResponseType | null;
  /** ISO date string of next follow-up action */
  nextActionDate: string | null;
  /** Free-form notes */
  notes: string;
  /** Reference to export/snapshot artifact ID */
  linkedArtifactId: string | null;
  /** ISO date string when archived; null means active */
  archivedAt: string | null;
  /** ISO date string of creation */
  createdAt: string;
  /** ISO date string of last update */
  updatedAt: string;
  /** Days after sentDate before follow-up is due. Default 14 if null. */
  followUpAfterDays: number | null;
  /** Optional expected response window in days from sentDate. */
  expectedResponseWindowDays: number | null;
  /** ISO date of last snooze expiry (null means no active snooze). */
  snoozedUntil: string | null;
  /** True if writer has dismissed the reminder permanently. */
  reminderDismissed: boolean;
  /** Timeline log entries for follow-up actions. */
  reminderLog: ReminderLogEntry[];
}
