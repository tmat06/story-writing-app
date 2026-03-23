'use client';

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { SubmissionEntry } from '@/types/submission';
import {
  getSubmissions,
  upsertSubmission,
  archiveSubmission,
  markFollowedUp,
  snoozeReminder,
  dismissReminder,
} from '@/lib/submissions';
import { KpiStrip } from './KpiStrip';
import { ReminderDigest } from './ReminderDigest';
import { SubmissionBoard } from './SubmissionBoard';
import { SubmissionTimeline } from './SubmissionTimeline';
import { SubmissionPanel } from './SubmissionPanel';
import { Toast } from '@/components/Toast/Toast';
import styles from './SubmissionTracker.module.css';

interface SubmissionTrackerProps {
  storyId: string;
}

export type SubmissionTrackerHandle = { openAddPanel: () => void };

type ViewTab = 'board' | 'timeline';

export const SubmissionTracker = forwardRef<SubmissionTrackerHandle, SubmissionTrackerProps>(
  function SubmissionTracker({ storyId }, ref) {
    const [entries, setEntries] = useState<SubmissionEntry[]>([]);
    const [viewTab, setViewTab] = useState<ViewTab>('board');
    const [panelEntry, setPanelEntry] = useState<SubmissionEntry | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastUndoFn, setToastUndoFn] = useState<(() => void) | null>(null);

    const loadEntries = useCallback(() => {
      setEntries(getSubmissions(storyId));
    }, [storyId]);

    useEffect(() => {
      loadEntries();
    }, [loadEntries]);

    const handleAddClick = () => {
      setPanelEntry(null);
      setPanelOpen(true);
    };

    useImperativeHandle(ref, () => ({ openAddPanel: handleAddClick }));

    const handleCardClick = (id: string) => {
      const entry = entries.find((e) => e.id === id) ?? null;
      setPanelEntry(entry);
      setPanelOpen(true);
    };

    const handleSave = (entry: SubmissionEntry) => {
      upsertSubmission(storyId, entry);
      loadEntries();
      setPanelOpen(false);
      setSavedId(entry.id);
      setTimeout(() => setSavedId(null), 2000);
    };

    const handleArchive = (id: string) => {
      archiveSubmission(storyId, id);
      loadEntries();
      setPanelOpen(false);
    };

    const handleClose = () => {
      setPanelOpen(false);
    };

    const showToast = (message: string, undoFn?: () => void) => {
      setToastMessage(message);
      setToastUndoFn(undoFn ? () => undoFn : null);
    };

    const handleMarkFollowedUp = (id: string) => {
      const snapshot = getSubmissions(storyId).find((e) => e.id === id);
      markFollowedUp(storyId, id);
      loadEntries();
      showToast('Follow-up recorded', snapshot ? () => {
        upsertSubmission(storyId, snapshot);
        loadEntries();
      } : undefined);
    };

    const handleSnooze = (id: string) => {
      const snapshot = getSubmissions(storyId).find((e) => e.id === id);
      snoozeReminder(storyId, id, 7);
      loadEntries();
      showToast('Snoozed 7 days', snapshot ? () => {
        upsertSubmission(storyId, snapshot);
        loadEntries();
      } : undefined);
    };

    const handleDismiss = (id: string) => {
      const snapshot = getSubmissions(storyId).find((e) => e.id === id);
      dismissReminder(storyId, id);
      loadEntries();
      showToast('Reminder dismissed', snapshot ? () => {
        upsertSubmission(storyId, snapshot);
        loadEntries();
      } : undefined);
    };

    const hasEntries = entries.filter((e) => !e.archivedAt).length > 0;

    return (
      <div className={styles.tracker}>
        <KpiStrip entries={entries} />

        {!hasEntries ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No submissions yet</p>
            <p className={styles.emptyHint}>
              Track your query rounds, agent replies, and revision follow-ups in one place.
            </p>
            <button
              type="button"
              className={styles.emptyAddButton}
              onClick={handleAddClick}
            >
              Add first submission
            </button>
          </div>
        ) : (
          <>
            <ReminderDigest
              entries={entries.filter((e) => !e.archivedAt)}
              onMarkFollowedUp={handleMarkFollowedUp}
              onSnooze={handleSnooze}
              onDismiss={handleDismiss}
            />

            <div className={styles.viewTabBar} role="tablist" aria-label="Submission view">
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'board'}
                className={`${styles.viewTab} ${viewTab === 'board' ? styles.viewTabActive : ''}`}
                onClick={() => setViewTab('board')}
              >
                Board
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === 'timeline'}
                className={`${styles.viewTab} ${viewTab === 'timeline' ? styles.viewTabActive : ''}`}
                onClick={() => setViewTab('timeline')}
              >
                Timeline
              </button>
            </div>

            <div className={styles.canvas}>
              {viewTab === 'board' ? (
                <SubmissionBoard
                  entries={entries}
                  onCardClick={handleCardClick}
                  highlightedId={savedId}
                />
              ) : (
                <SubmissionTimeline
                  entries={entries}
                  onCardClick={handleCardClick}
                  highlightedId={savedId}
                />
              )}
            </div>
          </>
        )}

        {panelOpen && (
          <SubmissionPanel
            storyId={storyId}
            entry={panelEntry}
            onSave={handleSave}
            onClose={handleClose}
            onArchive={handleArchive}
          />
        )}

        {toastMessage && (
          <Toast
            message={toastMessage}
            onDismiss={() => { setToastMessage(null); setToastUndoFn(null); }}
            onUndo={toastUndoFn ?? undefined}
          />
        )}
      </div>
    );
  }
);
