'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createPreviewLink,
  getActivePreviewLinks,
  revokePreviewLink,
  regeneratePreviewLink,
  DEFAULT_CHECKPOINT_QUESTIONS,
} from '@/lib/previewLinks';
import type { CheckpointQuestion } from '@/types/preview';
import { relativeTime } from '@/lib/relativeTime';
import type { PreviewLink } from '@/types/preview';
import styles from './SharePreviewDialog.module.css';

interface SharePreviewDialogProps {
  storyId: string;
  storyTitle: string;
  content: string;
  onClose: () => void;
}

export function SharePreviewDialog({ storyId, storyTitle, content, onClose }: SharePreviewDialogProps) {
  const [links, setLinks] = useState<PreviewLink[]>([]);
  const [confirmRevokeToken, setConfirmRevokeToken] = useState<string | null>(null);
  const [copySuccessToken, setCopySuccessToken] = useState<string | null>(null);
  const [expiryInput, setExpiryInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [checkpointsEnabled, setCheckpointsEnabled] = useState(false);
  const [checkpointMode, setCheckpointMode] = useState<'default' | 'custom'>('default');
  const [customQuestions, setCustomQuestions] = useState<string[]>(['', '', '']);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const refreshLinks = useCallback(() => {
    setLinks(getActivePreviewLinks(storyId));
  }, [storyId]);

  useEffect(() => {
    refreshLinks();
  }, [refreshLinks]);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, input, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, []);

  function previewUrl(token: string): string {
    return `${window.location.origin}/preview/${token}`;
  }

  function handleCopy(token: string) {
    navigator.clipboard.writeText(previewUrl(token));
    setCopySuccessToken(token);
    setTimeout(() => setCopySuccessToken(null), 2000);
  }

  function handleRevoke(token: string) {
    revokePreviewLink(storyId, token);
    setConfirmRevokeToken(null);
    refreshLinks();
  }

  function handleRegenerate(token: string) {
    regeneratePreviewLink(storyId, token, content);
    refreshLinks();
  }

  function handleCreate() {
    setCreateError(null);
    setIsCreating(true);
    try {
      let expiresAt: number | null = null;
      if (expiryInput) {
        expiresAt = new Date(expiryInput).getTime();
      }
      let questions: CheckpointQuestion[] | undefined;
      if (checkpointsEnabled) {
        if (checkpointMode === 'default') {
          questions = DEFAULT_CHECKPOINT_QUESTIONS;
        } else {
          const filled = customQuestions
            .map((text, i) => ({ id: `q${i + 1}`, text: text.trim() }))
            .filter((q) => q.text.length > 0);
          if (filled.length === 0) {
            setCreateError('Add at least one question, or switch to the default template.');
            setIsCreating(false);
            return;
          }
          questions = filled;
        }
      }
      const link = createPreviewLink(storyId, storyTitle, content, expiresAt, questions);
      handleCopy(link.token);
      setExpiryInput('');
      setCheckpointsEnabled(false);
      setCheckpointMode('default');
      setCustomQuestions(['', '', '']);
      refreshLinks();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setIsCreating(false);
    }
  }

  const activeCount = links.length;
  const atMax = activeCount >= 3;

  return (
    <div className={styles.overlay} onClick={onClose} aria-hidden="true">
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <h2 id="share-dialog-title" className={styles.dialogTitle}>Share Preview</h2>
          <button
            ref={closeButtonRef}
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close share dialog"
          >
            ×
          </button>
        </div>

        {links.length > 0 && (
          <ul className={styles.linkList} aria-label="Active preview links">
            {links.map((link) => (
              <li key={link.token} className={styles.linkRow}>
                <div className={styles.linkMeta}>
                  <span className={`${styles.statusBadge} ${styles.statusActive}`}>Active</span>
                  <span className={styles.linkDate}>Created {relativeTime(link.createdAt)}</span>
                  <span className={styles.linkExpiry}>
                    {link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}` : 'No expiry'}
                  </span>
                </div>
                <div className={styles.linkActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleCopy(link.token)}
                    aria-label="Copy preview link"
                  >
                    {copySuccessToken === link.token ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleRegenerate(link.token)}
                    aria-label="Regenerate preview link"
                  >
                    Regenerate
                  </button>
                  {confirmRevokeToken === link.token ? (
                    <span className={styles.confirmRevoke}>
                      Revoke this link?{' '}
                      <button className={styles.confirmBtn} onClick={() => handleRevoke(link.token)}>Confirm</button>
                      {' / '}
                      <button className={styles.confirmBtn} onClick={() => setConfirmRevokeToken(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button
                      className={styles.actionBtn}
                      onClick={() => setConfirmRevokeToken(link.token)}
                      aria-label="Revoke preview link"
                    >
                      Revoke
                    </button>
                  )}
                </div>
                {copySuccessToken === link.token && (
                  <span className={styles.copySuccess} aria-live="polite">Link copied to clipboard!</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {atMax ? (
          <p className={styles.maxLinksNotice}>
            Maximum 3 active preview links reached. Revoke one to create a new link.
          </p>
        ) : (
          <div className={styles.createSection}>
            <label htmlFor="expiry-date" className={styles.createLabel}>
              Optional expiry date
            </label>
            <input
              id="expiry-date"
              type="date"
              className={styles.dateInput}
              value={expiryInput}
              onChange={(e) => setExpiryInput(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            {createError && <p className={styles.createError}>{createError}</p>}
            <button
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Creating…' : 'Create preview link'}
            </button>
          </div>
        )}

        <div className={styles.checkpointSection}>
          <label className={styles.checkpointToggleLabel}>
            <input
              type="checkbox"
              checked={checkpointsEnabled}
              onChange={(e) => setCheckpointsEnabled(e.target.checked)}
              className={styles.checkpointToggle}
            />
            Enable structured checkpoints
          </label>

          {checkpointsEnabled && (
            <div className={styles.checkpointConfig}>
              <fieldset className={styles.templateRadios}>
                <legend className={styles.templateLegend}>Template</legend>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="checkpointMode"
                    value="default"
                    checked={checkpointMode === 'default'}
                    onChange={() => setCheckpointMode('default')}
                  />
                  Use default template
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="checkpointMode"
                    value="custom"
                    checked={checkpointMode === 'custom'}
                    onChange={() => setCheckpointMode('custom')}
                  />
                  Custom questions (up to 5)
                </label>
              </fieldset>

              {checkpointMode === 'default' && (
                <ul className={styles.defaultQuestionPreview}>
                  {DEFAULT_CHECKPOINT_QUESTIONS.map((q) => (
                    <li key={q.id}>{q.text}</li>
                  ))}
                </ul>
              )}

              {checkpointMode === 'custom' && (
                <div className={styles.customQuestions}>
                  {customQuestions.map((q, i) => (
                    <input
                      key={i}
                      type="text"
                      maxLength={200}
                      placeholder={`Question ${i + 1}`}
                      value={q}
                      className={styles.customQuestionInput}
                      onChange={(e) => {
                        const next = [...customQuestions];
                        next[i] = e.target.value;
                        setCustomQuestions(next);
                      }}
                    />
                  ))}
                  {customQuestions.length < 5 && (
                    <button
                      type="button"
                      className={styles.addQuestionBtn}
                      onClick={() => setCustomQuestions([...customQuestions, ''])}
                    >
                      + Add question
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
