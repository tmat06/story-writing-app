import { useState } from 'react';
import type { CollabThread, ThreadStatus } from '@/types/collaboration';
import { addComment, recordDecision, updateThread } from '@/lib/collaboration';
import styles from './CollabThreadDetail.module.css';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface CollabThreadDetailProps {
  thread: CollabThread;
  onClose: () => void;
  onMutate: () => void;
}

export function CollabThreadDetail({ thread, onClose, onMutate }: CollabThreadDetailProps) {
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [decisionPending, setDecisionPending] = useState<'accepted' | 'rejected' | null>(null);
  const [decisionActor, setDecisionActor] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [editStatus, setEditStatus] = useState<ThreadStatus>(thread.status);
  const [editAssignee, setEditAssignee] = useState(thread.assignee);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentAuthor.trim() || !commentBody.trim()) return;
    addComment(thread.storyId, thread.id, {
      author: commentAuthor.trim(),
      body: commentBody.trim(),
    });
    setCommentBody('');
    onMutate();
  };

  const handleRecordDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionPending || !decisionActor.trim()) return;
    recordDecision(thread.storyId, thread.id, {
      action: decisionPending,
      actor: decisionActor.trim(),
      note: decisionNote.trim(),
    });
    setDecisionPending(null);
    setDecisionActor('');
    setDecisionNote('');
    onMutate();
  };

  const handleStatusChange = (status: ThreadStatus) => {
    setEditStatus(status);
    updateThread(thread.storyId, thread.id, { status });
    onMutate();
  };

  const handleAssigneeChange = (assignee: string) => {
    setEditAssignee(assignee);
    updateThread(thread.storyId, thread.id, { assignee });
    onMutate();
  };

  const canDecide = thread.type === 'suggestion' && !thread.decision && thread.status !== 'resolved';

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div className={styles.detailMeta}>
          <span className={styles.typeLabel}>{thread.type}</span>
          <span className={styles.sceneLabel}>{thread.sceneTitle}</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close thread detail">
          ×
        </button>
      </div>
      <h4 className={styles.detailTitle}>{thread.title}</h4>

      <div className={styles.controls}>
        <div className={styles.controlRow}>
          <label className={styles.controlLabel}>Status</label>
          <select
            className={styles.controlSelect}
            value={editStatus}
            onChange={(e) => handleStatusChange(e.target.value as ThreadStatus)}
          >
            <option value="open">Open</option>
            <option value="needs-author">Needs Author</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className={styles.controlRow}>
          <label className={styles.controlLabel}>Assigned to</label>
          <input
            className={styles.controlInput}
            type="text"
            value={editAssignee}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            placeholder="Assignee name"
          />
        </div>
      </div>

      <div className={styles.timeline}>
        {thread.comments.length === 0 ? (
          <p className={styles.emptyTimeline}>No comments yet.</p>
        ) : (
          thread.comments.map((c) => (
            <div key={c.id} className={styles.commentItem}>
              <div className={styles.commentHeader}>
                <span className={styles.commentAuthor}>{c.author}</span>
                <span className={styles.commentTime}>{relativeTime(c.createdAt)}</span>
              </div>
              <p className={styles.commentBody}>{c.body}</p>
            </div>
          ))
        )}
      </div>

      {thread.decision && (
        <div className={styles.decisionBlock}>
          <div className={styles.decisionLabel}>
            {thread.decision.action === 'accepted' ? 'Accepted' : 'Rejected'} by{' '}
            {thread.decision.actor}
            <span className={styles.decisionTime}> · {relativeTime(thread.decision.timestamp)}</span>
          </div>
          {thread.decision.note && (
            <p className={styles.decisionNote}>{thread.decision.note}</p>
          )}
        </div>
      )}

      {canDecide && !decisionPending && (
        <div className={styles.decisionActions}>
          <button
            className={styles.acceptBtn}
            onClick={() => setDecisionPending('accepted')}
          >
            Accept
          </button>
          <button
            className={styles.rejectBtn}
            onClick={() => setDecisionPending('rejected')}
          >
            Reject
          </button>
        </div>
      )}

      {decisionPending && (
        <form className={styles.decisionForm} onSubmit={handleRecordDecision}>
          <div className={styles.decisionFormTitle}>
            {decisionPending === 'accepted' ? 'Accept' : 'Reject'} suggestion
          </div>
          <input
            className={styles.formInput}
            type="text"
            placeholder="Your name (required)"
            value={decisionActor}
            onChange={(e) => setDecisionActor(e.target.value)}
            required
            autoFocus
          />
          <textarea
            className={styles.formTextarea}
            placeholder="Note (optional)"
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            rows={2}
            maxLength={500}
          />
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn}>
              Confirm {decisionPending === 'accepted' ? 'Accept' : 'Reject'}
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setDecisionPending(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <form className={styles.commentForm} onSubmit={handleAddComment}>
        <div className={styles.formTitle}>Add comment</div>
        <input
          className={styles.formInput}
          type="text"
          placeholder="Your name"
          value={commentAuthor}
          onChange={(e) => setCommentAuthor(e.target.value)}
          required
        />
        <textarea
          className={styles.formTextarea}
          placeholder="Comment body"
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          rows={3}
          maxLength={1000}
          required
        />
        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn}>
            Post comment
          </button>
        </div>
      </form>
    </div>
  );
}
