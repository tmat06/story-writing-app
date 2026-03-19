import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Scene, SceneStatus } from '@/types/scene';
import styles from './SceneCard.module.css';

interface SceneCardProps {
  scene: Scene;
  storyId: string;
  onClick: () => void;
  onStatusChange: (status: SceneStatus) => void;
  onFieldChange: (field: 'intent' | 'pov' | 'characters', value: string) => void;
  isDragging?: boolean;
  isSynced?: boolean;
  isDropTarget?: boolean;
  isFocused?: boolean;
}

export function SceneCard({
  scene,
  storyId,
  onClick,
  onStatusChange,
  onFieldChange,
  isDragging = false,
  isSynced,
  isDropTarget,
  isFocused,
}: SceneCardProps) {
  const router = useRouter();
  const [editingField, setEditingField] = useState<'intent' | 'pov' | 'characters' | null>(null);
  const [intentDraft, setIntentDraft] = useState(scene.intent ?? '');
  const [povDraft, setPovDraft] = useState(scene.pov ?? '');
  const [charactersDraft, setCharactersDraft] = useState((scene.characters ?? []).join(', '));

  const rawContent =
    typeof window !== 'undefined'
      ? (localStorage.getItem(`story_${storyId}_scene_${scene.id}_content`) ?? '')
      : '';
  const wordCount =
    rawContent.trim().length > 0
      ? `~${rawContent.trim().split(/\s+/).length} wds`
      : '--';

  const handleJump = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/story/${storyId}?view=editor&scene=${scene.id}`);
  };

  useEffect(() => {
    setIntentDraft(scene.intent ?? '');
  }, [scene.intent]);

  useEffect(() => {
    setPovDraft(scene.pov ?? '');
  }, [scene.pov]);

  useEffect(() => {
    setCharactersDraft((scene.characters ?? []).join(', '));
  }, [scene.characters]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onStatusChange(e.target.value as SceneStatus);
  };

  return (
    <div
      className={`${styles.card} ${isDragging ? styles.dragging : ''} ${isDropTarget ? styles.dropTarget : ''} ${isFocused ? styles.focused : ''}`}
      data-synced={isSynced || undefined}
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
      <button
        className={styles.jumpBtn}
        onClick={handleJump}
        aria-label={`Open scene ${scene.title} in editor`}
        tabIndex={0}
      >
        Open in editor
      </button>

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

          {editingField === 'characters' ? (
            <input
              autoFocus
              className={styles.chipInput}
              value={charactersDraft}
              placeholder="e.g. Alex, Jordan"
              aria-label="Characters in scene"
              onChange={(e) => setCharactersDraft(e.target.value)}
              onBlur={() => {
                onFieldChange('characters', charactersDraft);
                setEditingField(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onFieldChange('characters', charactersDraft);
                  setEditingField(null);
                }
                if (e.key === 'Escape') {
                  setCharactersDraft((scene.characters ?? []).join(', '));
                  setEditingField(null);
                }
              }}
            />
          ) : (
            <button
              className={`${styles.chip} ${!(scene.characters?.length) ? styles.chipEmpty : ''}`}
              onClick={() => setEditingField('characters')}
              aria-label={scene.characters?.length ? `Characters: ${scene.characters.join(', ')}` : 'Add characters'}
              title="Characters present — click to edit (comma-separated)"
            >
              {scene.characters?.length
                ? (scene.characters.join(', ').length > 30
                    ? scene.characters.join(', ').slice(0, 30) + '…'
                    : scene.characters.join(', '))
                : 'Characters'}
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
          <span className={styles.wordCount}>{wordCount}</span>
        </div>
      </div>
    </div>
  );
}
