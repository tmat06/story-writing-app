'use client';

import { useState, useEffect, useRef } from 'react';
import { createThread, addComment } from '@/lib/collaboration';
import type { ThreadType } from '@/types/collaboration';
import type { Scene } from '@/types/scene';
import styles from './AddThreadModal.module.css';

interface Props {
  storyId: string;
  scenes: Scene[];
  onCreated: () => void;
  onClose: () => void;
}

const TYPE_OPTIONS: Array<{ value: ThreadType; label: string }> = [
  { value: 'question', label: 'Question' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'decision', label: 'Decision' },
];

export function AddThreadModal({ storyId, scenes, onCreated, onClose }: Props) {
  const [type, setType] = useState<ThreadType>('question');
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? '');
  const [firstComment, setFirstComment] = useState('');
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const selectedScene = scenes.find((s) => s.id === sceneId);
    const newThread = createThread(storyId, {
      sceneId,
      sceneTitle: selectedScene?.title ?? 'Untitled scene',
      type,
      title: title.trim(),
      assignee: assignee.trim(),
    });
    if (firstComment.trim()) {
      addComment(storyId, newThread.id, {
        author: assignee.trim() || 'Author',
        body: firstComment.trim(),
      });
    }
    onCreated();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>New Thread</h2>
          <button className={styles.closeBtn} aria-label="Close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Type</label>
            <div className={styles.typeGroup} role="group" aria-label="Thread type">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.typeBtn} ${type === opt.value ? styles.typeBtnActive : ''}`}
                  onClick={() => setType(opt.value)}
                  aria-pressed={type === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="thread-title" className={styles.label}>Title <span aria-hidden="true">*</span></label>
            <input
              id="thread-title"
              ref={titleRef}
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(''); }}
              placeholder="What is this thread about?"
              required
              aria-required="true"
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="thread-scene" className={styles.label}>Scene</label>
            <select
              id="thread-scene"
              className={styles.input}
              value={sceneId}
              onChange={(e) => setSceneId(e.target.value)}
            >
              {scenes.length === 0 && <option value="">No scenes</option>}
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="thread-assignee" className={styles.label}>Assignee</label>
            <input
              id="thread-assignee"
              type="text"
              className={styles.input}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Name or email"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="thread-comment" className={styles.label}>First comment (optional)</label>
            <textarea
              id="thread-comment"
              className={styles.textarea}
              value={firstComment}
              onChange={(e) => setFirstComment(e.target.value)}
              placeholder="Add context or details..."
              rows={3}
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn}>Create thread</button>
          </div>
        </form>
      </div>
    </div>
  );
}
