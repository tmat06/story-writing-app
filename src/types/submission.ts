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
}
