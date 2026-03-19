'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Scene } from '@/types/scene';
import type {
  DiagnosticThresholds,
  DiagnosticWarning,
  PovChapterShare,
  CharacterPresenceMatrix,
} from '@/types/diagnostics';
import {
  getDiagnosticsThresholds,
  setDiagnosticsThresholds,
  getDiagnosticDismissals,
  dismissDiagnosticWarning,
  snoozeDiagnosticWarning,
  computePovDistribution,
  computeCharacterPresenceMatrix,
  computeDiagnosticsWarnings,
  getPovBalanceStatus,
  getAbsentCharactersCount,
} from '@/lib/diagnostics';
import { KpiStrip } from './KpiStrip';
import { PovShareCard } from './PovShareCard';
import { CharacterPresenceHeatmap } from './CharacterPresenceHeatmap';
import { BalanceWarningList } from './BalanceWarningList';
import { DiagnosticsThresholdPanel } from './DiagnosticsThresholdPanel';
import styles from './DiagnosticsBoard.module.css';

interface DiagnosticsBoardProps {
  storyId: string;
  scenes: Scene[];
  onJumpToScene: (sceneId: string) => void;
}

interface ComputedState {
  thresholds: DiagnosticThresholds;
  povDist: PovChapterShare[];
  matrix: CharacterPresenceMatrix;
  warnings: DiagnosticWarning[];
}

export function DiagnosticsBoard({ storyId, scenes, onJumpToScene }: DiagnosticsBoardProps) {
  const [computed, setComputed] = useState<ComputedState | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [charFilter, setCharFilter] = useState<'all' | 'major'>('all');

  useEffect(() => {
    try {
      const thresholds = getDiagnosticsThresholds(storyId);
      const dismissals = getDiagnosticDismissals(storyId);
      const povDist = computePovDistribution(scenes);
      const matrix = computeCharacterPresenceMatrix(scenes);
      const warnings = computeDiagnosticsWarnings(scenes, thresholds, dismissals);
      setComputed({ thresholds, povDist, matrix, warnings });
      setComputeError(null);
    } catch (err) {
      setComputeError(err instanceof Error ? err.message : 'Unexpected error computing diagnostics.');
    }
  }, [storyId, scenes, retryTick]);

  const povBalanceStatus = useMemo(
    () => (computed ? getPovBalanceStatus(computed.warnings) : 'ok'),
    [computed]
  );
  const absentCharactersCount = useMemo(
    () => (computed ? getAbsentCharactersCount(computed.warnings) : 0),
    [computed]
  );

  const hasAnyMetadata = useMemo(() => {
    return scenes.some((s) => s.pov?.trim() || (s.characters?.length ?? 0) > 0);
  }, [scenes]);

  if (scenes.length === 0) {
    return (
      <div className={styles.board}>
        <p className={styles.emptyState}>Add scenes to your story to see diagnostics.</p>
      </div>
    );
  }

  if (!hasAnyMetadata) {
    return (
      <div className={styles.board}>
        <p className={styles.emptyState}>
          Tag scenes in the{' '}
          <button className={styles.inlineBtn} onClick={() => onJumpToScene(scenes[0].id)}>
            Corkboard
          </button>{' '}
          to unlock diagnostics.
        </p>
      </div>
    );
  }

  if (computeError) {
    return (
      <div className={styles.board}>
        <div className={styles.errorBanner}>
          <span>{computeError}</span>
          <button className={styles.retryBtn} onClick={() => setRetryTick((t) => t + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!computed) {
    return <div className={styles.board}><p className={styles.emptyState}>Loading diagnostics…</p></div>;
  }

  function handleDismiss(id: string) {
    dismissDiagnosticWarning(storyId, id);
    setRetryTick((t) => t + 1);
  }

  function handleSnooze(id: string) {
    snoozeDiagnosticWarning(storyId, id, computed!.thresholds.snoozeHours);
    setRetryTick((t) => t + 1);
  }

  function handleThresholdChange(t: DiagnosticThresholds) {
    setDiagnosticsThresholds(storyId, t);
    setRetryTick((t2) => t2 + 1);
  }

  return (
    <div className={styles.board}>
      <div className={styles.kpiRow}>
        <KpiStrip
          povBalanceStatus={povBalanceStatus}
          absentCharactersCount={absentCharactersCount}
          activeWarningsCount={computed.warnings.length}
        />
      </div>
      <div className={styles.mainRow}>
        <div className={styles.chartsCol}>
          <div className={styles.section}>
            <PovShareCard
              povDistribution={computed.povDist}
              onSegmentClick={(_chapter, _pov, sceneIds) => {
                if (sceneIds[0]) onJumpToScene(sceneIds[0]);
              }}
            />
          </div>
          <div className={styles.section}>
            <div className={styles.heatmapHeader}>
              <div className={styles.filterGroup} role="group" aria-label="Character filter">
                <button
                  className={`${styles.filterBtn} ${charFilter === 'all' ? styles.filterBtnActive : ''}`}
                  onClick={() => setCharFilter('all')}
                  aria-pressed={charFilter === 'all'}
                >
                  All
                </button>
                <button
                  className={`${styles.filterBtn} ${charFilter === 'major' ? styles.filterBtnActive : ''}`}
                  onClick={() => setCharFilter('major')}
                  aria-pressed={charFilter === 'major'}
                >
                  Major
                </button>
              </div>
            </div>
            <CharacterPresenceHeatmap
              matrix={computed.matrix}
              filter={charFilter}
              onCellClick={(_char, _chapter) => {/* no-op: informational */}}
            />
          </div>
        </div>
        <div className={styles.sidebarCol}>
          <div className={styles.section}>
            <BalanceWarningList
              warnings={computed.warnings}
              thresholds={computed.thresholds}
              onDismiss={handleDismiss}
              onSnooze={handleSnooze}
              onJumpToScene={onJumpToScene}
            />
          </div>
          <div className={styles.section}>
            <DiagnosticsThresholdPanel
              thresholds={computed.thresholds}
              onChange={handleThresholdChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
