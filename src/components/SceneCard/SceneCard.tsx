import type { Scene, SceneStatus } from '@/types/scene';
import styles from './SceneCard.module.css';

interface SceneCardProps {
  scene: Scene;
  onClick: () => void;
  onStatusChange: (status: SceneStatus) => void;
  isDragging?: boolean;
}

export function SceneCard({
  scene,
  onClick,
  onStatusChange,
  isDragging = false,
}: SceneCardProps) {
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onStatusChange(e.target.value as SceneStatus);
  };

  const handleCardClick = () => {
    // stopPropagation on select handlers is sufficient, no need for tagName check
    onClick();
  };

  return (
    <div
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Open scene: ${scene.title}`}
    >
      <div className={styles.dragHandle} aria-label="Drag to reorder">
        ⋮⋮
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{scene.title}</h3>
          <span className={styles.chapter}>{scene.chapter}</span>
        </div>

        <p className={styles.summary}>{scene.summary}</p>

        {(scene.pov || scene.location || scene.timeframe) && (
          <div className={styles.metadata}>
            {scene.pov && (
              <span className={styles.metaChip} title={scene.pov}>
                POV: {scene.pov}
              </span>
            )}
            {scene.location && (
              <span className={styles.metaChip} title={scene.location}>
                Loc: {scene.location}
              </span>
            )}
            {scene.timeframe && (
              <span className={styles.metaChip} title={scene.timeframe}>
                Time: {scene.timeframe}
              </span>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <select
            value={scene.status}
            onChange={handleStatusChange}
            className={styles.statusSelect}
            aria-label={`Scene status for ${scene.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="planned">Planned</option>
            <option value="drafting">Drafting</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
    </div>
  );
}
