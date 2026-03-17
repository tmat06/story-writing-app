'use client';

import { useState } from 'react';
import type { RevisionPass, PassType } from '@/types/revision';
import styles from './RevisionPassPanel.module.css';

const PASS_LABELS: Record<PassType, string> = {
  'arc-consistency': 'Arc Consistency',
  'promise-payoff': 'Promise / Payoff',
  'voice-drift': 'Voice Drift',
};

interface Props {
  passes: RevisionPass[];
}

export function RevisionHistoryList({ passes }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);

  if (passes.length === 0) return null;

  const selectedPass = passes.find((p) => p.id === selectedPassId) ?? null;

  return (
    <div className={styles.historySection}>
      <button
        className={styles.historySectionToggle}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        Previous passes ({passes.length})
        <span className={styles.historyToggleIcon}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className={styles.historyList}>
          {passes.map((pass) => {
            const resolved = pass.items.filter((i) => i.status !== 'open').length;
            const total = pass.items.length;
            const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
            return (
              <button
                key={pass.id}
                className={`${styles.historyRow} ${selectedPassId === pass.id ? styles.historyRowActive : ''}`}
                onClick={() => setSelectedPassId(pass.id === selectedPassId ? null : pass.id)}
              >
                <span>{PASS_LABELS[pass.type]}</span>
                <span>{new Date(pass.completedAt!).toLocaleDateString()}</span>
                <span>{pct}% resolved</span>
              </button>
            );
          })}
          {selectedPass && (
            <div className={styles.historyDetail}>
              {Array.from(new Set(selectedPass.items.map((i) => i.chapter))).map((chapter) => (
                <div key={chapter} className={styles.chapterGroup}>
                  <h5 className={styles.chapterHeading}>{chapter}</h5>
                  {selectedPass.items
                    .filter((i) => i.chapter === chapter)
                    .map((item) => (
                      <div key={item.id} className={styles.historyItem}>
                        <span className={styles.historyItemTitle}>{item.sceneTitle}</span>
                        <span className={`${styles.passStatusChip} ${styles[`chip_${item.status}`]}`}>
                          {item.status}
                        </span>
                        <p className={styles.checklistPrompt}>{item.prompt}</p>
                        {item.rationale && (
                          <p className={styles.historyRationale}>{item.rationale}</p>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
