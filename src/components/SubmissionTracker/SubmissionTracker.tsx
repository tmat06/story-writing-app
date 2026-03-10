'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SubmissionEntry } from '@/types/submission';
import {
  getSubmissions,
  upsertSubmission,
  archiveSubmission,
} from '@/lib/submissions';
import { ViewModeSwitch, type ViewMode } from '@/components/ViewModeSwitch/ViewModeSwitch';
import { KpiStrip } from './KpiStrip';
import { SubmissionBoard } from './SubmissionBoard';
import { SubmissionTimeline } from './SubmissionTimeline';
import { SubmissionPanel } from './SubmissionPanel';
import styles from './SubmissionTracker.module.css';

interface SubmissionTrackerProps {
  storyId: string;
  storyTitle?: string;
  onTitleChange?: (title: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

type ViewTab = 'board' | 'timeline';

export function SubmissionTracker({
  storyId,
  storyTitle,
  onTitleChange,
  viewMode,
  onViewModeChange,
}: SubmissionTrackerProps) {
  const [entries, setEntries] = useState<SubmissionEntry[]>([]);
  const [viewTab, setViewTab] = useState<ViewTab>('board');
  const [panelEntry, setPanelEntry] = useState<SubmissionEntry | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

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

  const hasEntries = entries.filter((e) => !e.archivedAt).length > 0;

  return (
    <div className={styles.tracker}>
      <div className={styles.header}>
        <input
          type="text"
          className={styles.titleInput}
          placeholder="Untitled Story"
          aria-label="Story title"
          value={storyTitle ?? ''}
          onChange={(e) => onTitleChange?.(e.target.value)}
        />
        <ViewModeSwitch mode={viewMode} onChange={onViewModeChange} />
        <button
          type="button"
          className={styles.addButton}
          onClick={handleAddClick}
        >
          Add Submission
        </button>
      </div>

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
    </div>
  );
}
