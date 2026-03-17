import type { ChapterPacingStats } from '@/types/pacing';
import type { SensitivityLevel } from '@/types/pacing';
import { computeStoryMedianWordCount } from '@/lib/pacing';
import styles from './PacingChart.module.css';

const THRESHOLDS: Record<SensitivityLevel, { warn: number; alert: number }> = {
  tight:    { warn: 0.15, alert: 0.30 },
  moderate: { warn: 0.25, alert: 0.50 },
  loose:    { warn: 0.40, alert: 0.70 },
};

interface PacingChartProps {
  stats: ChapterPacingStats[];
  sensitivity: SensitivityLevel;
}

function getBandClass(wordCount: number, median: number, sensitivity: SensitivityLevel): string {
  if (median === 0) return styles.segmentOk;
  const deviation = Math.abs(wordCount - median) / median;
  const threshold = THRESHOLDS[sensitivity];
  if (deviation > threshold.alert) return styles.segmentAlert;
  if (deviation > threshold.warn) return styles.segmentWarn;
  return styles.segmentOk;
}

function getBandLabel(wordCount: number, median: number, sensitivity: SensitivityLevel): string {
  if (median === 0) return 'normal';
  const deviation = Math.abs(wordCount - median) / median;
  const threshold = THRESHOLDS[sensitivity];
  if (deviation > threshold.alert) return 'outlier';
  if (deviation > threshold.warn) return 'moderate variance';
  return 'normal';
}

export function PacingChart({ stats, sensitivity }: PacingChartProps) {
  if (stats.length === 0) {
    return <p className={styles.emptyState}>No chapters to display.</p>;
  }

  const median = computeStoryMedianWordCount(stats);
  const totalWords = stats.reduce((sum, ch) => sum + ch.totalWords, 0);
  const shortest = stats.reduce((min, ch) => ch.totalWords < min.totalWords ? ch : min, stats[0]);
  const longest = stats.reduce((max, ch) => ch.totalWords > max.totalWords ? ch : max, stats[0]);

  return (
    <div>
      <div className={styles.legendRow}>
        <span><span className={`${styles.legendDot} ${styles.legendOk}`} />Normal</span>
        <span><span className={`${styles.legendDot} ${styles.legendWarn}`} />Moderate variance</span>
        <span><span className={`${styles.legendDot} ${styles.legendAlert}`} />Outlier</span>
      </div>
      <div className={styles.chart}>
        {stats.map((chapter) => (
          <div key={chapter.chapter} className={styles.chapterRow}>
            <span
              className={styles.chapterLabel}
              title={chapter.chapter}
            >
              {chapter.chapter}
            </span>
            <div className={styles.barContainer} role="img" aria-label={`${chapter.chapter} word count distribution`}>
              {chapter.scenes.map((scene) => {
                const bandClass = getBandClass(scene.wordCount, median, sensitivity);
                const bandLabel = getBandLabel(scene.wordCount, median, sensitivity);
                const flex = Math.max(scene.wordCount, 1);
                return (
                  <div
                    key={scene.sceneId}
                    className={`${styles.sceneSegment} ${bandClass}`}
                    style={{ flex }}
                    title={`${scene.sceneId} — ${scene.wordCount} words`}
                    aria-label={`${scene.sceneId}, ${scene.wordCount} words, ${bandLabel} range`}
                  />
                );
              })}
              {chapter.scenes.length === 0 && (
                <div
                  className={`${styles.sceneSegment} ${styles.segmentOk}`}
                  style={{ flex: 1 }}
                  aria-label="Empty chapter"
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Median</span>
          <span>{Math.round(median)} words/chapter</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Shortest</span>
          <span>{shortest.chapter} ({shortest.totalWords} words)</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Longest</span>
          <span>{longest.chapter} ({longest.totalWords} words)</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Total</span>
          <span>{totalWords.toLocaleString()} words</span>
        </div>
      </div>
    </div>
  );
}
