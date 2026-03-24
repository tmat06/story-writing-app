import { getStories } from '@/lib/stories';
import { getPasses } from '@/lib/revision';
import { getFeedback, markFeedbackRead } from '@/lib/previewLinks';
import { updateItem } from '@/lib/revision';
import type { NextUpItem, NextUpItemType } from '@/types/nextUpQueue';

function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
}

export function dismissForToday(storyId: string, type: NextUpItemType): void {
  localStorage.setItem(`nextup_dismiss_${storyId}_${type}`, todayDateString());
}

export function isDismissedForToday(storyId: string, type: NextUpItemType): boolean {
  return localStorage.getItem(`nextup_dismiss_${storyId}_${type}`) === todayDateString();
}

export function markRevisionItemDone(storyId: string, passId: string, itemId: string): void {
  updateItem(storyId, passId, itemId, { status: 'dismissed', rationale: '' });
}

export function markFeedbackDone(storyId: string, feedbackIds: string[]): void {
  markFeedbackRead(storyId, feedbackIds);
}

export function getNextUpItems(): NextUpItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stories = getStories().filter((s) => !s.isArchived);
    const items: NextUpItem[] = [];

    // Resume row: most recent story edited within 24h, not dismissed
    const recent = stories[0];
    if (
      recent &&
      Date.now() - recent.updatedAt < 86_400_000 &&
      !isDismissedForToday(recent.id, 'resume')
    ) {
      items.push({
        id: `resume-${recent.id}`,
        type: 'resume',
        storyId: recent.id,
        storyTitle: recent.title,
        actionLabel: 'Resume scene',
        contextLabel: recent.title,
        updatedAt: recent.updatedAt,
        href: `/story/${recent.id}`,
      });
    }

    // Revision row: first story with an open revision item
    for (const story of stories) {
      if (isDismissedForToday(story.id, 'revision')) continue;
      const passes = getPasses(story.id);
      let found = false;
      for (const pass of passes) {
        if (pass.completedAt) continue;
        const openItem = pass.items.find((i) => i.status === 'open');
        if (!openItem) continue;
        const prompt = openItem.prompt.length > 80
          ? openItem.prompt.slice(0, 80) + '…'
          : openItem.prompt;
        items.push({
          id: `revision-${pass.id}-${openItem.id}`,
          type: 'revision',
          storyId: story.id,
          storyTitle: story.title,
          actionLabel: 'Finish revision item',
          contextLabel: prompt,
          updatedAt: pass.startedAt,
          href: `/story/${story.id}?panel=revision`,
          passId: pass.id,
          itemId: openItem.id,
        });
        found = true;
        break;
      }
      if (found) break;
    }

    // Feedback row: first story with unread feedback
    for (const story of stories) {
      if (isDismissedForToday(story.id, 'feedback')) continue;
      const feedback = getFeedback(story.id);
      const unread = feedback.filter((f) => !f.isRead);
      if (unread.length === 0) continue;
      const n = unread.length;
      items.push({
        id: `feedback-${story.id}`,
        type: 'feedback',
        storyId: story.id,
        storyTitle: story.title,
        actionLabel: 'Review new feedback',
        contextLabel: `${n} unread response${n === 1 ? '' : 's'}`,
        updatedAt: Math.max(...unread.map((f) => f.submittedAt)),
        href: `/story/${story.id}?panel=feedback`,
        feedbackIds: unread.map((f) => f.id),
      });
      break;
    }

    // Sort: resume < revision < feedback, then desc updatedAt within same type
    const typePriority: Record<NextUpItemType, number> = { resume: 0, revision: 1, feedback: 2 };
    items.sort((a, b) => {
      const tp = typePriority[a.type] - typePriority[b.type];
      if (tp !== 0) return tp;
      return b.updatedAt - a.updatedAt;
    });

    return items.slice(0, 3);
  } catch {
    return [];
  }
}
