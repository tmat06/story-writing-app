import { useState } from 'react';
import type { ChapterPacingStats, PacingSnapshot } from '@/types/pacing';
import styles from './SnapshotPanel.module.css';

interface SnapshotPanelProps {
  snapshot: PacingSnapshot | null;
  currentAlertCount: number;
  currentStats: ChapterPacingStats[];
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function SnapshotPanel({ snapshot, currentAlertCount, currentStats }: SnapshotPanelProps) {
  const [open, setOpen] = useState(false);

  const currentTotalWords = currentStats.reduce((sum, ch) => sum + ch.totalWords, 0);
  const snapshotTotalWords = snapshot
    ? snapshot.chapterStats.reduce((sum, ch) => sum + ch.totalWords, 0)
    : 0;

  const alertDelta = snapshot ? currentAlertCount - snapshot.alertCount : 0;
  const wordDelta = snapshot ? currentTotalWords - snapshotTotalWords : 0;

  return (
    <div className={styles.panel}>
      <div
        className={styles.header}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}
      >
        <span className={styles.headerLabel}>
          Baseline Snapshot
          {snapshot && (
            <span className={styles.timestampBadge}>
              Taken at {formatTimestamp(snapshot.takenAt)}
            </span>
          )}
        </span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▼</span>
      </div>
      {open && (
        <div className={styles.body}>
          {!snapshot ? (
            <p className={styles.emptyState}>
              No snapshot taken — use the &ldquo;Take Snapshot&rdquo; button to save a baseline.
            </p>
          ) : (
            <div className={styles.comparison}>
              <p className={styles.comparisonSummary}>
                Before: {snapshot.alertCount} alert{snapshot.alertCount !== 1 ? 's' : ''} &nbsp;/&nbsp;
                After: {currentAlertCount} alert{currentAlertCount !== 1 ? 's' : ''}
                {' '}
                <span className={
                  alertDelta < 0 ? styles.deltaPositive :
                  alertDelta > 0 ? styles.deltaNegative :
                  styles.deltaNeutral
                }>
                  ({alertDelta > 0 ? '+' : ''}{alertDelta})
                </span>
              </p>
              <p className={styles.comparisonDetail}>
                Words at snapshot: {snapshotTotalWords.toLocaleString()} &nbsp;/&nbsp;
                Now: {currentTotalWords.toLocaleString()}
                {' '}
                <span className={wordDelta > 0 ? styles.deltaPositive : styles.deltaNeutral}>
                  ({wordDelta > 0 ? '+' : ''}{wordDelta.toLocaleString()})
                </span>
              </p>
              {alertDelta < 0 && (
                <p className={`${styles.comparisonDetail} ${styles.deltaPositive}`}>
                  {Math.abs(alertDelta)} alert{Math.abs(alertDelta) !== 1 ? 's' : ''} resolved since snapshot ✓
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
