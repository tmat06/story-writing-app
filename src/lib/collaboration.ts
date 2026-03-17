import type { CollabThread, CollabComment, DecisionRecord, ThreadType, ThreadStatus } from '@/types/collaboration';

const STATUS_ORDER: Record<ThreadStatus, number> = {
  'needs-author': 0,
  'open': 1,
  'resolved': 2,
};

function storageKey(storyId: string): string {
  return `collab:${storyId}`;
}

function loadAll(storyId: string): CollabThread[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(storyId));
    return raw ? (JSON.parse(raw) as CollabThread[]) : [];
  } catch {
    return [];
  }
}

function saveAll(storyId: string, threads: CollabThread[]): void {
  localStorage.setItem(storageKey(storyId), JSON.stringify(threads));
}

export function getThreads(storyId: string): CollabThread[] {
  const threads = loadAll(storyId);
  return threads.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.updatedAt - a.updatedAt;
  });
}

export function createThread(
  storyId: string,
  fields: {
    sceneId: string;
    sceneTitle: string;
    type: ThreadType;
    title: string;
    assignee: string;
  }
): CollabThread {
  const threads = loadAll(storyId);
  const now = Date.now();
  const newThread: CollabThread = {
    id: crypto.randomUUID(),
    storyId,
    sceneId: fields.sceneId,
    sceneTitle: fields.sceneTitle,
    type: fields.type,
    title: fields.title,
    status: 'open',
    assignee: fields.assignee,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
  threads.push(newThread);
  saveAll(storyId, threads);
  console.log('Collab: thread created', { threadId: newThread.id, type: newThread.type, storyId });
  return newThread;
}

export function updateThread(
  storyId: string,
  threadId: string,
  updates: Partial<Pick<CollabThread, 'status' | 'assignee' | 'title'>>
): void {
  const threads = loadAll(storyId);
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx === -1) return;
  threads[idx] = { ...threads[idx], ...updates, updatedAt: Date.now() };
  saveAll(storyId, threads);
}

export function addComment(
  storyId: string,
  threadId: string,
  comment: { author: string; body: string }
): CollabComment {
  const threads = loadAll(storyId);
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx === -1) throw new Error(`Thread ${threadId} not found`);
  const newComment: CollabComment = {
    id: crypto.randomUUID(),
    author: comment.author,
    body: comment.body,
    createdAt: Date.now(),
  };
  threads[idx].comments.push(newComment);
  threads[idx].updatedAt = Date.now();
  saveAll(storyId, threads);
  return newComment;
}

export function recordDecision(
  storyId: string,
  threadId: string,
  decision: { action: 'accepted' | 'rejected'; actor: string; note: string }
): void {
  const threads = loadAll(storyId);
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx === -1) return;
  const record: DecisionRecord = {
    action: decision.action,
    actor: decision.actor,
    note: decision.note,
    timestamp: Date.now(),
  };
  threads[idx].decision = record;
  threads[idx].status = 'resolved';
  threads[idx].updatedAt = Date.now();
  saveAll(storyId, threads);
  console.log('Collab: decision recorded', { threadId, action: decision.action, storyId });
}

export function getUnresolvedCount(storyId: string): number {
  return loadAll(storyId).filter((t) => t.status !== 'resolved').length;
}

export function filterThreads(
  threads: CollabThread[],
  filters: { status: ThreadStatus | 'all'; assignee: string; sceneId: string }
): CollabThread[] {
  return threads.filter((t) => {
    if (filters.status !== 'all' && t.status !== filters.status) return false;
    if (filters.assignee && !t.assignee.toLowerCase().includes(filters.assignee.toLowerCase()))
      return false;
    if (filters.sceneId && t.sceneId !== filters.sceneId) return false;
    return true;
  });
}
