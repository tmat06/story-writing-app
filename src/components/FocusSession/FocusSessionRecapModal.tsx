'use client';

import { useEffect, useRef, useState } from 'react';
import type { FocusSession, ObjectiveStatus } from '@/types/session';
import { OBJECTIVE_LABELS } from '@/types/session';
import type { Scene } from '@/types/scene';
import styles from './FocusSessionRecapModal.module.css';

interface FocusSessionRecapModalProps {
  session: FocusSession;
  scenes: Scene[];
  onSave: (handoffNote: string, nextSceneId: string | null, objectiveStatus: ObjectiveStatus) => void;
  onSaveAndOpenNext: (handoffNote: string, nextSceneId: string | null, objectiveStatus: ObjectiveStatus) => void;
  onDismiss: () => void;
}

export function FocusSessionRecapModal({
  session,
  scenes,
  onSave,
  onSaveAndOpenNext,
  onDismiss,
}: FocusSessionRecapModalProps) {
  const currentScene = scenes.find((s) => s.id === session.sceneId);
  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);
  const currentOrder = currentScene?.order ?? 0;
  const defaultNext = sortedScenes.find((s) => s.order === currentOrder + 1) ?? sortedScenes[0] ?? null;

  const [objectiveStatus, setObjectiveStatus] = useState<ObjectiveStatus>(session.objectiveStatus);
  const [nextSceneId, setNextSceneId] = useState<string>(defaultNext?.id ?? '');
  const objectiveLabel = OBJECTIVE_LABELS[session.objectiveType] ?? session.objectiveType;
  const defaultHandoff = defaultNext
    ? `Continue ${session.objectiveText} in ${defaultNext.title}`
    : `Continue ${session.objectiveText}`;
  const [handoffNote, setHandoffNote] = useState(defaultHandoff);

  const wordsAdded = (session.wordsAtEnd ?? 0) - session.wordsAtStart;
  const durationMinutes = session.endedAt
    ? Math.round((session.endedAt - session.startedAt) / 60000)
    : 0;

  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onDismiss]);

  return (
    <div className={styles.overlay} onClick={onDismiss}>
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recap-title"
      >
        <h2 id="recap-title" className={styles.title}>
          Session Recap
        </h2>

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Scene</span>
            <span className={styles.summaryValue}>{session.sceneName}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Objective</span>
            <span className={styles.summaryValue}>{objectiveLabel}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Words added</span>
            <span className={styles.summaryValue}>{Math.max(0, wordsAdded)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Duration</span>
            <span className={styles.summaryValue}>{durationMinutes} min</span>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Objective status</span>
          <div className={styles.statusRow}>
            <label className={`${styles.statusOption} ${objectiveStatus === 'in-progress' ? styles.statusOptionActive : ''}`}>
              <input
                type="radio"
                name="recap-status"
                value="in-progress"
                checked={objectiveStatus === 'in-progress'}
                onChange={() => setObjectiveStatus('in-progress')}
                className={styles.radioHidden}
              />
              Incomplete
            </label>
            <label className={`${styles.statusOption} ${objectiveStatus === 'complete' ? styles.statusOptionActive : ''}`}>
              <input
                type="radio"
                name="recap-status"
                value="complete"
                checked={objectiveStatus === 'complete'}
                onChange={() => setObjectiveStatus('complete')}
                className={styles.radioHidden}
              />
              Complete
            </label>
          </div>
        </div>

        {scenes.length > 0 && (
          <div className={styles.field}>
            <label htmlFor="recap-next-scene" className={styles.fieldLabel}>
              Next scene
            </label>
            <select
              id="recap-next-scene"
              className={styles.select}
              value={nextSceneId}
              onChange={(e) => setNextSceneId(e.target.value)}
            >
              <option value="">None</option>
              {sortedScenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="recap-handoff" className={styles.fieldLabel}>
            Handoff note
          </label>
          <textarea
            id="recap-handoff"
            className={styles.textarea}
            maxLength={200}
            rows={3}
            value={handoffNote}
            onChange={(e) => setHandoffNote(e.target.value)}
          />
          <span className={styles.charCount}>{handoffNote.length}/200</span>
        </div>

        <div className={styles.actions}>
          <button
            ref={firstButtonRef}
            className={styles.saveButton}
            onClick={() => onSave(handoffNote, nextSceneId || null, objectiveStatus)}
          >
            Save and close
          </button>
          {nextSceneId && (
            <button
              className={styles.saveNextButton}
              onClick={() => onSaveAndOpenNext(handoffNote, nextSceneId, objectiveStatus)}
            >
              Save and open next scene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
