import type { ChapterPacingStats, TensionTag } from '@/types/pacing';
import { setTensionTag } from '@/lib/pacing';
import styles from './TensionTagRow.module.css';

const TAG_OPTIONS: Array<{ value: TensionTag | null; label: string }> = [
  { value: null, label: '–' },
  { value: 'setup', label: 'Setup' },
  { value: 'build', label: 'Build' },
  { value: 'peak', label: 'Peak' },
  { value: 'release', label: 'Release' },
];

interface TensionTagRowProps {
  storyId: string;
  stats: ChapterPacingStats[];
  onTagChange: (sceneId: string, tag: TensionTag | null) => void;
}

export function TensionTagRow({ storyId, stats, onTagChange }: TensionTagRowProps) {
  if (stats.length === 0) {
    return <p className={styles.emptyState}>No scenes to tag.</p>;
  }

  const handleTagClick = (sceneId: string, tag: TensionTag | null, current: TensionTag | null) => {
    // Clicking the active tag removes it
    const newTag = tag === current ? null : tag;
    setTensionTag(storyId, sceneId, newTag);
    onTagChange(sceneId, newTag);
  };

  return (
    <div className={styles.container}>
      {stats.map((chapter) => {
        const distributionParts = (Object.entries(chapter.tagDistribution) as [TensionTag, number][])
          .filter(([, count]) => count > 0)
          .map(([tag, count]) => `${count} ${tag}`)
          .join(', ');

        return (
          <div key={chapter.chapter} className={styles.chapterSection}>
            <div className={styles.chapterHeading}>
              <span>{chapter.chapter}</span>
              {distributionParts && (
                <span className={styles.distributionPill}>{distributionParts}</span>
              )}
              {!chapter.hasPeakOrRelease && chapter.scenes.length > 0 && (
                <span className={styles.noTensionWarning} title="No peak or release scenes in this chapter">
                  ⚠
                </span>
              )}
            </div>
            {chapter.scenes.map((scene) => (
              <div key={scene.sceneId} className={styles.sceneRow}>
                <span className={styles.sceneTitle} title={scene.sceneId}>
                  {scene.sceneId}
                </span>
                <div className={styles.tagPills} role="group" aria-label={`Tension tag for ${scene.sceneId}`}>
                  {TAG_OPTIONS.map(({ value, label }) => {
                    const isActive = scene.tensionTag === value;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`${styles.tagPill} ${isActive ? styles.tagPillActive : ''}`}
                        aria-pressed={isActive}
                        onClick={() => handleTagClick(scene.sceneId, value, scene.tensionTag)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
