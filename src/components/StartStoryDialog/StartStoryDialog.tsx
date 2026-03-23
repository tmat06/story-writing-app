'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './StartStoryDialog.module.css';

interface StartStoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'blank' | 'starter') => void;
  isCreating: boolean;
}

export default function StartStoryDialog({
  isOpen,
  onClose,
  onConfirm,
  isCreating,
}: StartStoryDialogProps) {
  const [selected, setSelected] = useState<'blank' | 'starter'>('blank');
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Reset selection and focus title on each open
  useEffect(() => {
    if (isOpen) {
      setSelected('blank');
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCardKeyDown = (e: React.KeyboardEvent, mode: 'blank' | 'starter') => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setSelected(mode);
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected('starter');
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected('blank');
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-story-title"
        aria-describedby="start-story-desc"
      >
        <div className={styles.header}>
          <h2
            id="start-story-title"
            className={styles.title}
            ref={titleRef}
            tabIndex={-1}
          >
            Start new story
          </h2>
          <p id="start-story-desc" className={styles.subtitle}>
            Choose how to begin.
          </p>
        </div>

        <div className={styles.body} role="radiogroup" aria-label="Start mode">
          {/* Blank draft card */}
          <div
            className={`${styles.optionCard} ${selected === 'blank' ? styles.optionCardSelected : ''}`}
            role="radio"
            aria-checked={selected === 'blank'}
            tabIndex={selected === 'blank' ? 0 : -1}
            onClick={() => setSelected('blank')}
            onKeyDown={(e) => handleCardKeyDown(e, 'blank')}
          >
            <p className={styles.optionTitle}>Blank draft</p>
            <p className={styles.optionDesc}>
              Opens with an empty scene list. Add your own structure.
            </p>
          </div>

          {/* Starter template card */}
          <div
            className={`${styles.optionCard} ${selected === 'starter' ? styles.optionCardSelected : ''}`}
            role="radio"
            aria-checked={selected === 'starter'}
            tabIndex={selected === 'starter' ? 0 : -1}
            onClick={() => setSelected('starter')}
            onKeyDown={(e) => handleCardKeyDown(e, 'starter')}
          >
            <p className={styles.optionTitle}>Starter template</p>
            <p className={styles.optionDesc}>
              Adds Chapter 1 with two empty placeholder scenes. Remove them any time.
            </p>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className={styles.createButton}
            onClick={() => onConfirm(selected)}
            disabled={isCreating}
          >
            {isCreating ? 'Creating…' : 'Create story'}
          </button>
        </div>
      </div>
    </div>
  );
}
