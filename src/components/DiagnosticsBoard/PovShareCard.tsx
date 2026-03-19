import { useMemo } from 'react';
import type { PovChapterShare } from '@/types/diagnostics';
import styles from './PovShareCard.module.css';

interface PovShareCardProps {
  povDistribution: PovChapterShare[];
  onSegmentClick: (chapter: string, pov: string, sceneIds: string[]) => void;
}

const POV_OPACITIES = [1.0, 0.6, 0.35, 0.2];

export function PovShareCard({ povDistribution, onSegmentClick }: PovShareCardProps) {
  const povNames = useMemo(() => {
    const nameSet = new Set<string>();
    for (const { breakdown } of povDistribution) {
      for (const name of Object.keys(breakdown)) {
        nameSet.add(name);
      }
    }
    return Array.from(nameSet).filter((n) => n !== '').sort();
  }, [povDistribution]);

  if (povDistribution.length === 0) {
    return (
      <div className={styles.card}>
        <h3 className={styles.heading}>POV Distribution</h3>
        <p className={styles.empty}>No scenes with chapter data found.</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>POV Distribution</h3>
      <div className={styles.chart}>
        {povDistribution.map(({ chapter, total, breakdown }) => (
          <div key={chapter} className={styles.row}>
            <span className={styles.chapterLabel}>{chapter}</span>
            <div className={styles.bar}>
              {total === 0 ? (
                <div className={styles.emptyBar} />
              ) : (
                Object.entries(breakdown).map(([pov, count], idx) => {
                  const pct = (count / total) * 100;
                  const opacity = POV_OPACITIES[idx % POV_OPACITIES.length];
                  return (
                    <button
                      key={pov || '__untagged__'}
                      className={styles.segment}
                      style={{ width: `${pct}%`, opacity }}
                      aria-label={`${chapter}: ${pov || 'Untagged'} — ${count} scene${count !== 1 ? 's' : ''} (${Math.round(pct)}%)`}
                      tabIndex={0}
                      onClick={() => onSegmentClick(chapter, pov, [])}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSegmentClick(chapter, pov, []);
                        }
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
      {povNames.length > 0 && (
        <div className={styles.legend}>
          {povNames.map((name, idx) => (
            <span key={name} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ opacity: POV_OPACITIES[idx % POV_OPACITIES.length] }}
              />
              {name}
            </span>
          ))}
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ opacity: 0.15 }} />
            Untagged
          </span>
        </div>
      )}
    </div>
  );
}
