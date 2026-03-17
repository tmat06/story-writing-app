import { useState, useEffect, useRef } from 'react';
import type { ThreadType } from '@/types/collaboration';
import type { Scene } from '@/types/scene';
import { createThread } from '@/lib/collaboration';
import styles from './AddThreadModal.module.css';

const THREAD_TYPES: { value: ThreadType; label: string }[] = [
  { value: 'question', label: 'Question' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'decision', label: 'Decision' },
];

interface AddThreadModalProps {
  storyId: string;
  scenes: Scene[];
  onClose: () => void;
  onCreated: () => void;
}

export function AddThreadModal({ storyId, scenes, onClose, onCreated }: AddThreadModalProps) {
  const [type, setType] = useState<ThreadType>('question');
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [firstComment, setFirstComment] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const scene = scenes.find((s) => s.id === sceneId);
    createThread(storyId, {
      storyId,
      sceneId,
      sceneTitle: sceneId ? (scene?.title ?? 'Unknown scene') : 'Story-level',
      type,
      title: title.trim(),
      status: 'open',
      assignee: assignee.trim(),
    });

    onCreated();
  };

  const selectedScene = scenes.find((s) => s.id === sceneId);
  const sceneName = sceneId ? (selectedScene?.title ?? 'Unknown') : 'Story-level';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Add collaboration thread">
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add thread</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <div className={styles.typeGroup} role="group" aria-label="Thread type">
              {THREAD_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`${styles.typeBtn} ${type === t.value ? styles.typeBtnActive : ''}`}
                  onClick={() => setType(t.value)}
                  aria-pressed={type === t.value}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="thread-title">
              Title <span className={styles.required}>*</span>
            </label>
            <input
              ref={firstInputRef}
              id="thread-title"
              className={styles.input}
              type="text"
              placeholder="Describe the thread topic"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="thread-assignee">
              Assignee
            </label>
            <input
              id="thread-assignee"
              className={styles.input}
              type="text"
              placeholder="Name (optional)"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="thread-scene">
              Scene
            </label>
            <select
              id="thread-scene"
              className={styles.input}
              value={sceneId ?? 'story'}
              onChange={(e) => setSceneId(e.target.value === 'story' ? null : e.target.value)}
            >
              <option value="story">Story-level</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <span className={styles.fieldHint}>{sceneName}</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="thread-comment">
              First comment (optional)
            </label>
            <textarea
              id="thread-comment"
              className={styles.textarea}
              placeholder="Add context or initial message"
              value={firstComment}
              onChange={(e) => setFirstComment(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn} disabled={!title.trim()}>
              Add thread
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
