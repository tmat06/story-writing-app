import type {
  CollabThread,
  CollabComment,
  DecisionRecord,
  ThreadStatus,
  CollabFilters,
} from '@/types/collaboration';

const COLLAB_KEY = (storyId: string) => `story-${storyId}-collab`;

const STATUS_PRIORITY: Record<ThreadStatus, number> = {
  'needs-author': 0,
  open: 1,
  resolved: 2,
};

function load(storyId: string): CollabThread[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COLLAB_KEY(storyId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(storyId: string, threads: CollabThread[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COLLAB_KEY(storyId), JSON.stringify(threads));
}

export function getThreads(storyId: string): CollabThread[] {
  const threads = load(storyId);
  return [...threads].sort((a, b) => {
    const pDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (pDiff !== 0) return pDiff;
    return b.updatedAt - a.updatedAt;
  });
}

export function createThread(
  storyId: string,
  fields: Omit<CollabThread, 'id' | 'comments' | 'createdAt' | 'updatedAt'>
): CollabThread {
  const threads = load(storyId);
  const now = Date.now();
  const thread: CollabThread = {
    ...fields,
    id: crypto.randomUUID(),
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
  console.log('Collab: thread created', { threadId: thread.id, type: thread.type, storyId });
  save(storyId, [...threads, thread]);
  return thread;
}

export function updateThread(
  storyId: string,
  threadId: string,
  updates: Partial<Pick<CollabThread, 'status' | 'assignee' | 'title'>>
): void {
  const threads = load(storyId);
  save(
    storyId,
    threads.map((t) =>
      t.id === threadId ? { ...t, ...updates, updatedAt: Date.now() } : t
    )
  );
}

export function addComment(
  storyId: string,
  threadId: string,
  comment: Omit<CollabComment, 'id' | 'createdAt'>
): CollabComment {
  const threads = load(storyId);
  const newComment: CollabComment = {
    ...comment,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  save(
    storyId,
    threads.map((t) =>
      t.id === threadId
        ? { ...t, comments: [...t.comments, newComment], updatedAt: Date.now() }
        : t
    )
  );
  return newComment;
}

export function recordDecision(
  storyId: string,
  threadId: string,
  decision: Omit<DecisionRecord, 'timestamp'>
): void {
  const threads = load(storyId);
  const record: DecisionRecord = { ...decision, timestamp: Date.now() };
  console.log('Collab: decision recorded', { threadId, action: decision.action, storyId });
  save(
    storyId,
    threads.map((t) =>
      t.id === threadId
        ? { ...t, decision: record, status: 'resolved' as ThreadStatus, updatedAt: Date.now() }
        : t
    )
  );
}

export function getUnresolvedCount(storyId: string): number {
  return load(storyId).filter((t) => t.status !== 'resolved').length;
}

export function filterThreads(
  threads: CollabThread[],
  filters: CollabFilters
): CollabThread[] {
  return threads.filter((t) => {
    if (filters.status && filters.status.length > 0 && !filters.status.includes(t.status)) {
      return false;
    }
    if (filters.assignee && !t.assignee.toLowerCase().includes(filters.assignee.toLowerCase())) {
      return false;
    }
    if (filters.sceneId !== undefined && t.sceneId !== filters.sceneId) {
      return false;
    }
    return true;
  });
}
