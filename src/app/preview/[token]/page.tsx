'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { resolvePreviewLink, submitFeedback } from '@/lib/previewLinks';
import type { PreviewLink } from '@/types/preview';
import styles from './page.module.css';

interface PreviewPageProps {
  params: Promise<{ token: string }>;
}

function PreviewPageInner({ token }: { token: string }) {
  const [link, setLink] = useState<PreviewLink | null | undefined>(undefined);
  const [reaction, setReaction] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const resolved = resolvePreviewLink(token);
    setLink(resolved);
  }, [token]);

  if (link === undefined) {
    return (
      <div className={styles.page}>
        <p className={styles.header}>Story Writing App · Preview</p>
      </div>
    );
  }

  if (link === null) {
    return (
      <div className={styles.errorPage}>
        <p>This preview is no longer available.</p>
      </div>
    );
  }

  function handleSubmit() {
    if (!reaction || !link) return;
    submitFeedback(token, link.storyId, reaction, comment);
    setSubmitted(true);
  }

  return (
    <div className={styles.page}>
      <p className={styles.header}>Story Writing App · <span>Preview</span></p>
      <h1 className={styles.title}>{link.storyTitle}</h1>
      <article className={styles.content}>{link.contentSnapshot}</article>

      <div className={styles.feedbackSection}>
        {submitted ? (
          <p>Thank you for your feedback!</p>
        ) : (
          <>
            <h2 className={styles.feedbackTitle}>Leave a reaction</h2>
            <div className={styles.reactionButtons}>
              <button
                className={styles.reactionBtn}
                data-selected={reaction === 'up' ? 'true' : undefined}
                onClick={() => setReaction('up')}
                aria-pressed={reaction === 'up'}
              >
                Thumbs up
              </button>
              <button
                className={styles.reactionBtn}
                data-selected={reaction === 'down' ? 'true' : undefined}
                onClick={() => setReaction('down')}
                aria-pressed={reaction === 'down'}
              >
                Thumbs down
              </button>
            </div>
            <label htmlFor="preview-comment" className={styles.commentLabel}>
              Leave a comment (optional)
            </label>
            <textarea
              id="preview-comment"
              className={styles.commentInput}
              placeholder="Leave a comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={4}
            />
            <p className={styles.charCount}>{comment.length} / 500</p>
            <button
              className={styles.submitBtn}
              disabled={reaction === null}
              onClick={handleSubmit}
              type="button"
            >
              Submit feedback
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PreviewPage({ params }: PreviewPageProps) {
  const { token } = use(params);
  return (
    <Suspense>
      <PreviewPageInner token={token} />
    </Suspense>
  );
}
