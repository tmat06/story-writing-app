'use client';

import type { RevisionPass } from '@/types/revision';
import { exportPassReport } from '@/lib/revision';
import styles from './RevisionPassPanel.module.css';

interface Props {
  pass: RevisionPass;
  storyTitle: string;
  onComplete: () => void;
}

export function RevisionSummary({ pass, storyTitle, onComplete }: Props) {
  const chapters = Array.from(new Set(pass.items.map((i) => i.chapter)));
  const totalUnresolved = pass.items.filter((i) => i.status === 'open').length;
  const allResolved = totalUnresolved === 0;

  const handleExport = () => {
    const text = exportPassReport(pass, storyTitle);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'revision-pass.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.summaryModule}>
      <div className={styles.summaryStats}>
        {chapters.map((chapter) => {
          const count = pass.items.filter((i) => i.chapter === chapter && i.status === 'open').length;
          return (
            <div key={chapter} className={styles.summaryRow}>
              <span className={styles.summaryChapter}>{chapter}</span>
              <span className={styles.summaryCount}>{count} unresolved</span>
            </div>
          );
        })}
        <div className={styles.summaryTotals}>
          <span>Open: {totalUnresolved}</span>
          <span>Accepted: {pass.items.filter((i) => i.status === 'accepted').length}</span>
          <span>Dismissed: {pass.items.filter((i) => i.status === 'dismissed').length}</span>
        </div>
      </div>
      <div className={styles.summaryActions}>
        <button
          className={styles.completeBtn}
          onClick={onComplete}
          disabled={!allResolved}
          title={!allResolved ? 'Resolve all items to complete this pass' : undefined}
        >
          Mark pass complete
        </button>
        <button className={styles.exportBtn} onClick={handleExport}>
          Export pass report
        </button>
      </div>
    </div>
  );
}
