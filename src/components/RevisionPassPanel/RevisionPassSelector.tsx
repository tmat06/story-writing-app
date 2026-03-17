'use client';

import type { PassType, RevisionPass } from '@/types/revision';
import styles from './RevisionPassPanel.module.css';

const PASS_TYPES: { type: PassType; name: string; description: string }[] = [
  {
    type: 'arc-consistency',
    name: 'Arc Consistency',
    description: 'Check that each scene serves the central arc and moves the story forward.',
  },
  {
    type: 'promise-payoff',
    name: 'Promise / Payoff',
    description: 'Verify setups have payoffs and all promises are fulfilled.',
  },
  {
    type: 'voice-drift',
    name: 'Voice Drift',
    description: 'Ensure POV and narrative voice stay consistent across scenes.',
  },
];

function completionPct(pass: RevisionPass): string {
  const total = pass.items.length;
  if (total === 0) return '0/0';
  const resolved = pass.items.filter((i) => i.status !== 'open').length;
  return `${resolved}/${total}`;
}

interface Props {
  activePasses: Record<PassType, RevisionPass | null>;
  completedPasses: Record<PassType, RevisionPass | null>;
  onStart: (type: PassType) => void;
  onResume: (type: PassType) => void;
}

export function RevisionPassSelector({ activePasses, completedPasses, onStart, onResume }: Props) {
  return (
    <div className={styles.passSelector}>
      {PASS_TYPES.map(({ type, name, description }) => {
        const active = activePasses[type];
        const completed = completedPasses[type];
        return (
          <div key={type} className={styles.passCard}>
            <div className={styles.passCardInfo}>
              <span className={styles.passName}>{name}</span>
              <span className={styles.passDesc}>{description}</span>
            </div>
            <div className={styles.passCardActions}>
              {active ? (
                <>
                  <span className={styles.passStatusChip}>In progress · {completionPct(active)} resolved</span>
                  <button className={styles.passButton} onClick={() => onResume(type)}>
                    Resume
                  </button>
                </>
              ) : completed ? (
                <>
                  <span className={styles.passStatusChip}>
                    Completed {new Date(completed.completedAt!).toLocaleDateString()}
                  </span>
                  <button className={styles.passButton} onClick={() => onStart(type)}>
                    New pass
                  </button>
                </>
              ) : (
                <button className={styles.passButton} onClick={() => onStart(type)}>
                  Start pass
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
