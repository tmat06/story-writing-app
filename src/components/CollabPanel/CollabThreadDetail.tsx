'use client';

import { useState } from 'react';
import { relativeTime } from '@/lib/relativeTime';
import { addComment, updateThread, recordDecision } from '@/lib/collaboration';
import type { CollabThread, ThreadStatus } from '@/types/collaboration';
import styles from './CollabThreadDetail.module.css';

interface Props {
  thread: CollabThread;
  onUpdate: () => void;
}

export function CollabThreadDetail({ thread, onUpdate }: Props) {
  const [localAssignee, setLocalAssignee] = useState(thread.assignee);
  const [commentBody, setCommentBody] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [showDecision, setShowDecision] = useState(false);

  const handleAssigneeBlur = () => {
    updateThread(thread.storyId, thread.id, { assignee: localAssignee });
    onUpdate();
  };

  const handleStatusChange = (status: ThreadStatus) => {
    updateThread(thread.storyId, thread.id, { status });
    onUpdate();
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    addComment(thread.storyId, thread.id, {
      author: localAssignee.trim() || 'Author',
      body: commentBody.trim(),
    });
    setCommentBody('');
    onUpdate();
  };

  const handleDecision = (action: 'accepted' | 'rejected') => {
    recordDecision(thread.storyId, thread.id, {
      action,
      actor: localAssignee.trim() || 'Author',
      note: decisionNote.trim(),
    });
    setShowDecision(false);
    setDecisionNote('');
    onUpdate();
  };

  return (
    <div className={styles.detail}>
      <div className={styles.metaRow}>
        <div className={styles.metaField}>
          <label className={styles.metaLabel} htmlFor={`assignee-${thread.id}`}>Assignee</label>
          <input
            id={`assignee-${thread.id}`}
            className={styles.assigneeInput}
            type="text"
            value={localAssignee}
            onChange={(e) => setLocalAssignee(e.target.value)}
            onBlur={handleAssigneeBlur}
            placeholder="Unassigned"
          />
        </div>
        {thread.status !== 'resolved' && (
          <div className={styles.metaField}>
            <label className={styles.metaLabel} htmlFor={`status-${thread.id}`}>Status</label>
            <select
              id={`status-${thread.id}`}
              className={styles.statusSelect}
              value={thread.status}
              onChange={(e) => handleStatusChange(e.target.value as ThreadStatus)}
            >
              <option value="open">Open</option>
              <option value="needs-author">Needs author</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        )}
      </div>

      <div className={styles.timeline}>
        {thread.comments.length === 0 && !thread.decision && (
          <p className={styles.emptyTimeline}>No comments yet.</p>
        )}
        {thread.comments.map((c) => (
          <div key={c.id} className={styles.timelineItem}>
            <div className={styles.commentHeader}>
              <span className={styles.commentAuthor}>{c.author}</span>
              <span className={styles.commentTime}>{relativeTime(c.createdAt)}</span>
            </div>
            <p className={styles.commentBody}>{c.body}</p>
          </div>
        ))}
        {thread.decision && (
          <div className={`${styles.timelineItem} ${styles.decisionRecord}`}>
            <div className={styles.commentHeader}>
              <span className={`${styles.decisionBadge} ${styles[`decision_${thread.decision.action}`]}`}>
                {thread.decision.action === 'accepted' ? 'Accepted' : 'Rejected'}
              </span>
              <span className={styles.commentAuthor}>{thread.decision.actor}</span>
              <span className={styles.commentTime}>{relativeTime(thread.decision.timestamp)}</span>
            </div>
            {thread.decision.note && (
              <p className={styles.commentBody}>{thread.decision.note}</p>
            )}
          </div>
        )}
      </div>

      {thread.status !== 'resolved' && (
        <>
          <form className={styles.commentForm} onSubmit={handleAddComment}>
            <textarea
              className={styles.commentInput}
              placeholder="Add a comment..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={2}
              aria-label="Comment text"
            />
            <button type="submit" className={styles.commentSubmit} disabled={!commentBody.trim()}>
              Comment
            </button>
          </form>

          {thread.type === 'suggestion' && !thread.decision && (
            <div className={styles.decisionActions}>
              {!showDecision ? (
                <button className={styles.decisionToggle} onClick={() => setShowDecision(true)}>
                  Accept / Reject
                </button>
              ) : (
                <div className={styles.decisionForm}>
                  <textarea
                    className={styles.commentInput}
                    placeholder="Optional note..."
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    rows={2}
                    aria-label="Decision note"
                  />
                  <div className={styles.decisionBtns}>
                    <button
                      className={`${styles.decisionBtn} ${styles.acceptBtn}`}
                      onClick={() => handleDecision('accepted')}
                    >
                      Accept
                    </button>
                    <button
                      className={`${styles.decisionBtn} ${styles.rejectBtn}`}
                      onClick={() => handleDecision('rejected')}
                    >
                      Reject
                    </button>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => { setShowDecision(false); setDecisionNote(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
