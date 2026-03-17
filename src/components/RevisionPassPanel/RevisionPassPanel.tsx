'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Scene } from '@/types/scene';
import type { PassType, RevisionPass } from '@/types/revision';
import {
  getPasses,
  getActivePass,
  getLatestCompletedPass,
  createPass,
  updateItem,
  completePass,
} from '@/lib/revision';
import { RevisionPassSelector } from './RevisionPassSelector';
import { RevisionChecklist } from './RevisionChecklist';
import { RevisionSummary } from './RevisionSummary';
import { RevisionHistoryList } from './RevisionHistoryList';
import styles from './RevisionPassPanel.module.css';
import type { ItemStatus } from '@/types/revision';

const PASS_TYPES: PassType[] = ['arc-consistency', 'promise-payoff', 'voice-drift'];

const PASS_LABELS: Record<PassType, string> = {
  'arc-consistency': 'Arc Consistency',
  'promise-payoff': 'Promise / Payoff',
  'voice-drift': 'Voice Drift',
};

interface Props {
  storyId: string;
  storyTitle: string;
  scenes: Scene[];
  onSceneJump: (sceneId: string) => void;
}

export function RevisionPassPanel({ storyId, storyTitle, scenes, onSceneJump }: Props) {
  const [activePassType, setActivePassType] = useState<PassType | null>(null);
  const [currentPass, setCurrentPass] = useState<RevisionPass | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const activePasses = Object.fromEntries(
    PASS_TYPES.map((t) => [t, getActivePass(storyId, t)])
  ) as Record<PassType, RevisionPass | null>;

  const completedPasses = Object.fromEntries(
    PASS_TYPES.map((t) => [t, getLatestCompletedPass(storyId, t)])
  ) as Record<PassType, RevisionPass | null>;

  const allCompletedPasses = getPasses(storyId).filter((p) => !!p.completedAt);

  useEffect(() => {
    if (activePassType) {
      const pass = getActivePass(storyId, activePassType);
      setCurrentPass(pass);
    }
  }, [storyId, activePassType, tick]);

  const handleStart = (type: PassType) => {
    const pass = createPass(storyId, type, scenes);
    setActivePassType(type);
    setCurrentPass(pass);
  };

  const handleResume = (type: PassType) => {
    const pass = getActivePass(storyId, type);
    setActivePassType(type);
    setCurrentPass(pass);
  };

  const handleItemSave = (itemId: string, status: ItemStatus, rationale: string) => {
    if (!currentPass) return;
    updateItem(storyId, currentPass.id, itemId, { status, rationale });
    refresh();
  };

  const handleComplete = () => {
    if (!currentPass) return;
    completePass(storyId, currentPass.id);
    setActivePassType(null);
    setCurrentPass(null);
    refresh();
  };

  const handleBackToSelector = () => {
    setActivePassType(null);
    setCurrentPass(null);
  };

  return (
    <div className={styles.revisionPanel}>
      {activePassType && currentPass ? (
        <>
          <div className={styles.panelHeader}>
            <button className={styles.backBtn} onClick={handleBackToSelector} aria-label="Back to pass selector">
              ← Back
            </button>
            <span className={styles.panelTitle}>{PASS_LABELS[activePassType]}</span>
          </div>
          <div className={styles.checklistScroll}>
            <RevisionChecklist
              pass={currentPass}
              onItemSave={handleItemSave}
              onSceneJump={onSceneJump}
            />
          </div>
          <RevisionSummary
            pass={currentPass}
            storyTitle={storyTitle}
            onComplete={handleComplete}
          />
        </>
      ) : (
        <>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Revision Passes</span>
          </div>
          <RevisionPassSelector
            activePasses={activePasses}
            completedPasses={completedPasses}
            onStart={handleStart}
            onResume={handleResume}
          />
          <RevisionHistoryList passes={allCompletedPasses} />
        </>
      )}
    </div>
  );
}
