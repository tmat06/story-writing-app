'use client';

import { useState, useEffect } from 'react';
import { getFeedback, markFeedbackRead, getActivePreviewLinks } from '@/lib/previewLinks';
import { relativeTime } from '@/lib/relativeTime';
import type { PreviewFeedback } from '@/types/preview';
import styles from './PreviewFeedbackPanel.module.css';

interface PreviewFeedbackPanelProps {
  storyId: string;
  onRead?: () => void;
}

export function PreviewFeedbackPanel({ storyId, onRead }: PreviewFeedbackPanelProps) {
  const [feedback, setFeedback] = useState<PreviewFeedback[]>([]);
  const [hasActiveLinks, setHasActiveLinks] = useState(false);

  useEffect(() => {
    const entries = getFeedback(storyId);
    setFeedback(entries);
    setHasActiveLinks(getActivePreviewLinks(storyId).length > 0);
    if (entries.length > 0) {
      markFeedbackRead(storyId, entries.map((f) => f.id));
      onRead?.();
    }
  }, [storyId]);

  if (feedback.length === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.emptyState}>
          {hasActiveLinks
            ? 'Waiting for reader feedback. Share this link with trusted readers.'
            : 'Share a chapter for private feedback. Create your first preview link.'}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {feedback.map((entry) => (
        <div key={entry.id} className={styles.feedbackRow}>
          <div className={styles.feedbackHeader}>
            <span className={styles.readerLabel}>{entry.readerId}</span>
            <span className={styles.reactionLabel}>
              {entry.reaction === 'up' ? 'Liked' : 'Disliked'}
            </span>
            <span className={styles.reactionLabel}>{relativeTime(entry.submittedAt)}</span>
          </div>
          {entry.comment && (
            <p className={styles.comment}>{entry.comment}</p>
          )}
        </div>
      ))}
    </div>
  );
}
