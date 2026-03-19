'use client';

import { useState, useEffect, useMemo } from 'react';
import { getFeedback, markFeedbackRead, getActivePreviewLinks, getPreviewLinks } from '@/lib/previewLinks';
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
  const [filterQuestionId, setFilterQuestionId] = useState<string | null>(null);

  useEffect(() => {
    const entries = getFeedback(storyId);
    setFeedback(entries);
    setHasActiveLinks(getActivePreviewLinks(storyId).length > 0);
    if (entries.length > 0) {
      markFeedbackRead(storyId, entries.map((f) => f.id));
      onRead?.();
    }
  }, [storyId, onRead]);

  const checkpointSummary = useMemo(() => {
    const links = getPreviewLinks(storyId);
    const questionMap: Record<string, { text: string; answers: { readerId: string; answer: string; feedbackId: string }[] }> = {};
    for (const link of links) {
      for (const q of (link.checkpointQuestions ?? [])) {
        if (!questionMap[q.id]) questionMap[q.id] = { text: q.text, answers: [] };
      }
    }
    for (const entry of feedback) {
      for (const r of (entry.checkpointResponses ?? [])) {
        if (questionMap[r.questionId]) {
          questionMap[r.questionId].answers.push({ readerId: entry.readerId, answer: r.answer, feedbackId: entry.id });
        }
      }
    }
    return Object.entries(questionMap).map(([id, val]) => ({ id, ...val }));
  }, [feedback, storyId]);

  function handleExportCSV() {
    const rows = ['Reader,Question,Answer'];
    for (const q of checkpointSummary) {
      for (const a of q.answers) {
        rows.push(`"${a.readerId}","${q.text.replace(/"/g, '""')}","${a.answer.replace(/"/g, '""')}"`);
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'checkpoint-feedback.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportText() {
    const lines: string[] = [];
    for (const q of checkpointSummary) {
      lines.push(`Question: ${q.text}`);
      for (const a of q.answers) {
        lines.push(`  ${a.readerId}: ${a.answer}`);
      }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'checkpoint-feedback.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

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

  const visibleQuestions = filterQuestionId
    ? checkpointSummary.filter((q) => q.id === filterQuestionId)
    : checkpointSummary;

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

      {checkpointSummary.length > 0 && (
        <div className={styles.checkpointSummary}>
          <h3 className={styles.checkpointSummaryTitle}>Checkpoint responses</h3>

          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={filterQuestionId ?? ''}
              onChange={(e) => setFilterQuestionId(e.target.value || null)}
              aria-label="Filter by question"
            >
              <option value="">All questions</option>
              {checkpointSummary.map((q) => (
                <option key={q.id} value={q.id}>{q.text.slice(0, 60)}{q.text.length > 60 ? '…' : ''}</option>
              ))}
            </select>
          </div>

          {visibleQuestions.map((q) => (
            <div key={q.id} className={styles.questionBlock}>
              <p className={styles.questionHeading}>{q.text}</p>
              {q.answers.length === 0 ? (
                <p className={styles.noAnswers}>No responses yet.</p>
              ) : (
                q.answers.map((a) => (
                  <div key={a.feedbackId} className={styles.answerRow}>
                    <span className={styles.answerReader}>{a.readerId}</span>
                    <p className={styles.answerText}>{a.answer}</p>
                  </div>
                ))
              )}
            </div>
          ))}

          <div className={styles.exportRow}>
            <button className={styles.exportBtn} onClick={handleExportCSV}>Export CSV</button>
            <button className={styles.exportBtn} onClick={handleExportText}>Export text</button>
          </div>
        </div>
      )}
    </div>
  );
}
