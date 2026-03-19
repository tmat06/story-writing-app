import type { PreviewLink, PreviewFeedback } from '@/types/preview';

const MAX_ACTIVE_LINKS = 3;

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

function linksKey(storyId: string): string {
  return `preview_links_${storyId}`;
}

function feedbackKey(storyId: string): string {
  return `preview_feedback_${storyId}`;
}

function readerSeqKey(token: string): string {
  return `preview_reader_seq_${token}`;
}

function loadLinks(storyId: string): PreviewLink[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(linksKey(storyId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLinks(storyId: string, links: PreviewLink[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(linksKey(storyId), JSON.stringify(links));
}

function loadFeedback(storyId: string): PreviewFeedback[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(feedbackKey(storyId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFeedback(storyId: string, feedback: PreviewFeedback[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(feedbackKey(storyId), JSON.stringify(feedback));
}

export function createPreviewLink(
  storyId: string,
  storyTitle: string,
  content: string,
  expiresAt?: number | null
): PreviewLink {
  const links = loadLinks(storyId);
  const activeCount = links.filter((l) => l.status === 'active').length;
  if (activeCount >= MAX_ACTIVE_LINKS) {
    throw new Error(`Maximum ${MAX_ACTIVE_LINKS} active preview links reached. Revoke one to create a new link.`);
  }
  const token = generateToken();
  const link: PreviewLink = {
    token,
    storyId,
    storyTitle,
    contentSnapshot: content,
    createdAt: Date.now(),
    expiresAt: expiresAt ?? null,
    status: 'active',
  };
  const updated = [link, ...links];
  saveLinks(storyId, updated);
  return link;
}

export function getPreviewLinks(storyId: string): PreviewLink[] {
  return loadLinks(storyId);
}

export function getActivePreviewLinks(storyId: string): PreviewLink[] {
  const now = Date.now();
  const links = loadLinks(storyId);
  return links.filter((l) => {
    if (l.status !== 'active') return false;
    if (l.expiresAt !== null && l.expiresAt < now) return false;
    return true;
  });
}

export function resolvePreviewLink(token: string): PreviewLink | null {
  // v1: same-browser only — scan all preview_links_* keys
  if (typeof window === 'undefined') return null;
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('preview_links_')) continue;
    try {
      const links: PreviewLink[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      const idx = links.findIndex((l) => l.token === token);
      if (idx === -1) continue;
      const link = links[idx];
      if (link.status === 'revoked') return null;
      if (link.expiresAt !== null && link.expiresAt < now) {
        // auto-expire
        links[idx] = { ...link, status: 'expired' };
        localStorage.setItem(key, JSON.stringify(links));
        return null;
      }
      if (link.status === 'expired') return null;
      return link;
    } catch {
      continue;
    }
  }
  return null;
}

export function revokePreviewLink(storyId: string, token: string): void {
  const links = loadLinks(storyId);
  const updated = links.map((l) => l.token === token ? { ...l, status: 'revoked' as const } : l);
  saveLinks(storyId, updated);
}

export function regeneratePreviewLink(
  storyId: string,
  oldToken: string,
  content: string
): PreviewLink {
  const links = loadLinks(storyId);
  const old = links.find((l) => l.token === oldToken);
  const expiresAt = old?.expiresAt ?? null;
  revokePreviewLink(storyId, oldToken);
  return createPreviewLink(storyId, old?.storyTitle ?? '', content, expiresAt);
}

export function submitFeedback(
  token: string,
  storyId: string,
  reaction: 'up' | 'down',
  comment: string
): void {
  if (typeof window === 'undefined') return;
  const seqKey = readerSeqKey(token);
  const seq = parseInt(localStorage.getItem(seqKey) ?? '0', 10) + 1;
  localStorage.setItem(seqKey, String(seq));
  const entry: PreviewFeedback = {
    id: crypto.randomUUID(),
    token,
    storyId,
    reaction,
    comment,
    readerId: `Reader ${seq}`,
    submittedAt: Date.now(),
    isRead: false,
  };
  const existing = loadFeedback(storyId);
  saveFeedback(storyId, [entry, ...existing]);
}

export function getFeedback(storyId: string): PreviewFeedback[] {
  return loadFeedback(storyId);
}

export function markFeedbackRead(storyId: string, feedbackIds: string[]): void {
  const feedback = loadFeedback(storyId);
  const updated = feedback.map((f) =>
    feedbackIds.includes(f.id) ? { ...f, isRead: true } : f
  );
  saveFeedback(storyId, updated);
}

export function getUnreadFeedbackCount(storyId: string): number {
  if (typeof window === 'undefined') return 0;
  return loadFeedback(storyId).filter((f) => !f.isRead).length;
}
