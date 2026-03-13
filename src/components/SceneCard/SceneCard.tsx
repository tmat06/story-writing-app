import { useState, useEffect } from 'react';
import type { Scene, SceneStatus } from '@/types/scene';
import styles from './SceneCard.module.css';

interface SceneCardProps {
  scene: Scene;
  storyId: string;
  onClick: () => void;
  onStatusChange: (status: SceneStatus) => void;
  onFieldChange: (field: 'intent' | 'pov', value: string) => void;
  isDragging?: boolean;
}

export function SceneCard({
  scene,
  onClick,
  onStatusChange,
  onFieldChange,
  isDragging = false,
}: SceneCardProps) {
  const [editingField, setEditingField] = useState<'intent' | 'pov' | null>(null);
  const [intentDraft, setIntentDraft] = useState(scene.intent ?? '');
  const [povDraft, setPovDraft] = useState(scene.pov ?? '');

  useEffect(() => {
    setIntentDraft(scene.intent ?? '');
  }, [scene.intent]);

  useEffect(() => {
    setPovDraft(scene.pov ?? '');
  }, [scene.pov]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onStatusChange(e.target.value as SceneStatus);
  };

  return (
    <div
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      onClick={onClick}
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

        <div className={styles.metadata} onClick={(e) => e.stopPropagation()}>
          {editingField === 'intent' ? (
            <input
              autoFocus
              className={styles.chipInput}
              value={intentDraft}
              placeholder="Scene intent"
              aria-label="Scene intent"
              onChange={(e) => setIntentDraft(e.target.value)}
              onBlur={() => {
                onFieldChange('intent', intentDraft);
                setEditingField(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onFieldChange('intent', intentDraft);
                  setEditingField(null);
                }
                if (e.key === 'Escape') {
                  setIntentDraft(scene.intent ?? '');
                  setEditingField(null);
                }
              }}
            />
          ) : (
            <button
              className={`${styles.chip} ${!scene.intent ? styles.chipEmpty : ''}`}
              onClick={() => setEditingField('intent')}
              aria-label={scene.intent ? `Intent: ${scene.intent}` : 'Add intent'}
              title="Scene intent — click to edit"
            >
              {scene.intent || 'Intent'}
            </button>
          )}

          {editingField === 'pov' ? (
            <input
              autoFocus
              className={styles.chipInput}
              value={povDraft}
              placeholder="POV character"
              aria-label="POV character"
              onChange={(e) => setPovDraft(e.target.value)}
              onBlur={() => {
                onFieldChange('pov', povDraft);
                setEditingField(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onFieldChange('pov', povDraft);
                  setEditingField(null);
                }
                if (e.key === 'Escape') {
                  setPovDraft(scene.pov ?? '');
                  setEditingField(null);
                }
              }}
            />
          ) : (
            <button
              className={`${styles.chip} ${!scene.pov ? styles.chipEmpty : ''}`}
              onClick={() => setEditingField('pov')}
              aria-label={scene.pov ? `POV: ${scene.pov}` : 'Add POV'}
              title="POV character — click to edit"
            >
              {scene.pov || 'POV'}
            </button>
          )}
        </div>

        <p className={styles.summary}>{scene.summary}</p>

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
