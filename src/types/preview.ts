export type PreviewLinkStatus = 'active' | 'expired' | 'revoked';

export interface CheckpointQuestion {
  id: string;       // short id e.g. 'q1'
  text: string;     // the question prompt shown to reader
}

export interface CheckpointResponse {
  questionId: string;
  answer: string;   // free-text, max 500 chars
}

export interface PreviewLink {
  token: string;            // 32-char URL-safe string
  storyId: string;
  storyTitle: string;
  contentSnapshot: string;  // snapshot of autosaved content at link creation time
  createdAt: number;
  expiresAt: number | null; // null = no expiry
  status: PreviewLinkStatus;
  checkpointEnabled: boolean;
  checkpointQuestions: CheckpointQuestion[];
}

export interface PreviewFeedback {
  id: string;
  token: string;
  storyId: string;
  reaction: 'up' | 'down';
  comment: string;          // max 500 chars, may be empty string
  readerId: string;         // e.g. "Reader 1", from per-token sequence
  submittedAt: number;
  isRead: boolean;          // for unread badge
  checkpointResponses: CheckpointResponse[];
}
