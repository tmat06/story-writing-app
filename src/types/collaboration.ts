export type ThreadType = 'question' | 'suggestion' | 'decision';
export type ThreadStatus = 'open' | 'needs-author' | 'resolved';

export interface CollabComment {
  id: string;
  author: string;
  body: string;
  createdAt: number;
}

export interface DecisionRecord {
  action: 'accepted' | 'rejected';
  actor: string;
  note: string;
  timestamp: number;
}

export interface CollabThread {
  id: string;
  storyId: string;
  sceneId: string | null;
  sceneTitle: string;
  type: ThreadType;
  title: string;
  status: ThreadStatus;
  assignee: string;
  comments: CollabComment[];
  decision?: DecisionRecord;
  createdAt: number;
  updatedAt: number;
}

export interface CollabFilters {
  assignee?: string;
  status?: ThreadStatus[];
  sceneId?: string | null;
}
