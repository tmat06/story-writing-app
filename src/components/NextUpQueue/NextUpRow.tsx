'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { NextUpItem } from '@/types/nextUpQueue';
import { dismissForToday, markRevisionItemDone, markFeedbackDone } from '@/lib/homeQueue';
import styles from './NextUpQueue.module.css';

const BADGE_LABELS: Record<NextUpItem['type'], string> = {
  resume: 'RESUME',
  revision: 'REVISION',
  feedback: 'FEEDBACK',
};

interface NextUpRowProps {
  item: NextUpItem;
  onDone: (item: NextUpItem) => void;
  onDismiss: (item: NextUpItem) => void;
}

export function NextUpRow({ item, onDone, onDismiss }: NextUpRowProps) {
  const [isFading, setIsFading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleDone = () => {
    try {
      if (item.type === 'revision' && item.passId && item.itemId) {
        markRevisionItemDone(item.storyId, item.passId, item.itemId);
      } else if (item.type === 'feedback' && item.feedbackIds) {
        markFeedbackDone(item.storyId, item.feedbackIds);
      }
      setIsFading(true);
      setTimeout(() => onDone(item), 180);
    } catch {
      setMutationError("Couldn't update — please try again.");
    }
  };

  const handleDismiss = () => {
    dismissForToday(item.storyId, item.type);
    setIsDismissed(true);
    setTimeout(() => onDismiss(item), 2000);
  };

  if (isDismissed) {
    return <li className={styles.dismissConfirm}>Dismissed until tomorrow</li>;
  }

  return (
    <li className={`${styles.row} ${isFading ? styles.rowFading : ''}`}>
      <div className={styles.rowMain}>
        <div className={styles.rowLeft}>
          <span className={styles.badge}>{BADGE_LABELS[item.type]}</span>
          <span className={styles.actionLabel}>{item.actionLabel}</span>
          <span className={styles.contextLabel}>{item.storyTitle} · {item.contextLabel}</span>
        </div>
        <div className={styles.rowRight}>
          <Link
            href={item.href}
            className={styles.ctaButton}
            aria-label={`${item.actionLabel} — ${item.storyTitle}`}
          >
            Go
          </Link>
          {item.type === 'resume' ? (
            <button className={styles.secondaryAction} onClick={handleDismiss}>
              Dismiss for today
            </button>
          ) : (
            <button className={styles.secondaryAction} onClick={handleDone}>
              Mark done
            </button>
          )}
        </div>
      </div>
      {mutationError && (
        <p className={styles.rowError} role="status" aria-live="polite">{mutationError}</p>
      )}
    </li>
  );
}
