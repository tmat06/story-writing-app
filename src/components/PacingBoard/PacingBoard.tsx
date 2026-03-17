'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Scene } from '@/types/scene';
import type { SensitivityLevel, ChapterPacingStats, PacingAlert, PacingSnapshot, TensionTag } from '@/types/pacing';
import {
  computeChapterStats,
  computeAlerts,
  getDismissedAlerts,
  dismissAlert,
  loadSnapshot,
  saveSnapshot,
} from '@/lib/pacing';
import { PacingChart } from './PacingChart';
import { TensionTagRow } from './TensionTagRow';
import { AlertPanel } from './AlertPanel';
import { SnapshotPanel } from './SnapshotPanel';
import styles from './PacingBoard.module.css';

interface PacingBoardProps {
  storyId: string;
  scenes: Scene[];
  onJumpToScene: (sceneId: string) => void;
}

const SENSITIVITY_OPTIONS: Array<{ value: SensitivityLevel; label: string }> = [
  { value: 'tight', label: 'Tight' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'loose', label: 'Loose' },
];

export function PacingBoard({ storyId, scenes, onJumpToScene }: PacingBoardProps) {
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('moderate');
  const [chapterStats, setChapterStats] = useState<ChapterPacingStats[]>([]);
  const [alerts, setAlerts] = useState<PacingAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [snapshot, setSnapshot] = useState<PacingSnapshot | null>(null);

  const recompute = useCallback(
    (stats: ChapterPacingStats[], dismissed: Set<string>, sens: SensitivityLevel) => {
      const computed = computeAlerts(stats, sens, dismissed);
      setAlerts(computed);
    },
    []
  );

  // Initial load
  useEffect(() => {
    const dismissed = getDismissedAlerts(storyId);
    const stats = computeChapterStats(storyId, scenes);
    const snap = loadSnapshot(storyId);
    setDismissedIds(dismissed);
    setChapterStats(stats);
    setSnapshot(snap);
    recompute(stats, dismissed, sensitivity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, scenes]);

  // Recompute when sensitivity changes
  useEffect(() => {
    recompute(chapterStats, dismissedIds, sensitivity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensitivity]);

  const handleTagChange = (_sceneId: string, _tag: TensionTag | null) => {
    const stats = computeChapterStats(storyId, scenes);
    setChapterStats(stats);
    recompute(stats, dismissedIds, sensitivity);
  };

  const handleDismiss = (alertId: string) => {
    dismissAlert(storyId, alertId);
    const updated = new Set(dismissedIds);
    updated.add(alertId);
    setDismissedIds(updated);
    recompute(chapterStats, updated, sensitivity);
  };

  const handleTakeSnapshot = () => {
    const snap: PacingSnapshot = {
      takenAt: Date.now(),
      alertCount: alerts.length,
      chapterStats,
    };
    saveSnapshot(storyId, snap);
    setSnapshot(snap);
  };

  if (scenes.length === 0) {
    return (
      <p className={styles.emptyState}>
        Add chapters and scenes to your story to see pacing analysis.
      </p>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.sensitivityLabel}>Sensitivity:</span>
          <div className={styles.sensitivitySwitch} role="group" aria-label="Alert sensitivity">
            {SENSITIVITY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={sensitivity === value ? styles.sensitivityActive : styles.sensitivityInactive}
                aria-pressed={sensitivity === value}
                onClick={() => setSensitivity(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={styles.snapshotButton}
          onClick={handleTakeSnapshot}
        >
          Take Snapshot
        </button>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionHeading}>Word Count Distribution</h3>
        <PacingChart stats={chapterStats} sensitivity={sensitivity} />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionHeading}>Tension Tags</h3>
        <TensionTagRow
          storyId={storyId}
          stats={chapterStats}
          onTagChange={handleTagChange}
        />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionHeading}>Pacing Alerts ({alerts.length})</h3>
        <AlertPanel
          alerts={alerts}
          onDismiss={handleDismiss}
          onJumpToScene={onJumpToScene}
        />
      </div>

      <div className={styles.section}>
        <SnapshotPanel
          snapshot={snapshot}
          currentAlertCount={alerts.length}
          currentStats={chapterStats}
        />
      </div>
    </div>
  );
}
