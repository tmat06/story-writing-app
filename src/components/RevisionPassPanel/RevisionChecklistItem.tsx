'use client';

import { useState, useRef, useEffect } from 'react';
import type { RevisionItem, ItemStatus } from '@/types/revision';
import styles from './RevisionPassPanel.module.css';

interface Props {
  item: RevisionItem;
  onSave: (itemId: string, status: ItemStatus, rationale: string) => void;
  onSceneJump: (sceneId: string) => void;
}

export function RevisionChecklistItem({ item, onSave, onSceneJump }: Props) {
  const [status, setStatus] = useState<ItemStatus>(item.status);
  const [rationale, setRationale] = useState(item.rationale);
  const [editing, setEditing] = useState(item.status === 'open' && !item.rationale);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [rationale]);

  const handleSave = () => {
    if ((status === 'accepted' || status === 'dismissed') && !rationale.trim()) {
      setError('Note required before saving.');
      return;
    }
    setError('');
    onSave(item.id, status, rationale.trim());
    setEditing(false);
  };

  const saved = item.status !== 'open' && !editing;

  return (
    <div className={`${styles.checklistItem} ${styles[`item_${item.status}`]}`}>
      <div className={styles.checklistItemHeader}>
        {item.sceneId ? (
          <button
            className={styles.sceneLink}
            onClick={() => onSceneJump(item.sceneId!)}
            title="Jump to scene in Corkboard"
          >
            {item.sceneTitle}
          </button>
        ) : (
          <span className={styles.sceneLinkStatic}>{item.sceneTitle}</span>
        )}
        <span className={`${styles.passStatusChip} ${styles[`chip_${item.status}`]}`}>
          {item.status}
        </span>
      </div>
      <p className={styles.checklistPrompt}>{item.prompt}</p>

      {saved && !editing ? (
        <div className={styles.savedRationale}>
          <span className={styles.savedRationaleText}>{item.rationale}</span>
          <button className={styles.editRationaleBtn} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      ) : (
        <div className={styles.checklistControls}>
          <div className={styles.statusGroup} role="group" aria-label="Item status">
            {(['open', 'accepted', 'dismissed'] as ItemStatus[]).map((s) => (
              <button
                key={s}
                className={`${styles.statusBtn} ${status === s ? styles.statusBtnActive : ''}`}
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className={styles.rationaleField}
            placeholder="Add a note…"
            aria-label="Revision note"
            value={rationale}
            onChange={(e) => {
              setRationale(e.target.value);
              if (error) setError('');
            }}
            rows={2}
          />
          {error && <p className={styles.fieldError} role="alert">{error}</p>}
          <button className={styles.saveItemBtn} onClick={handleSave}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}
