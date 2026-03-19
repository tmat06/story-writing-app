'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './CanonImpactWarningDialog.module.css';

interface CanonImpactWarningDialogProps {
  open: boolean;
  entityName: string;
  impactSummary: { storyCount: number; sceneCount: number };
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CanonImpactWarningDialog({
  open,
  entityName,
  impactSummary,
  onConfirm,
  onCancel,
}: CanonImpactWarningDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} aria-modal="true" role="alertdialog" aria-labelledby="impact-dialog-title" aria-describedby="impact-dialog-desc">
      <div className={styles.dialog} ref={dialogRef}>
        <div className={styles.warningBanner}>
          <span className={styles.warningIcon}>⚠</span>
          <strong id="impact-dialog-title">Shared entity will be updated</strong>
        </div>
        <p id="impact-dialog-desc" className={styles.body}>
          Updating <strong>{entityName}</strong> will affect{' '}
          {impactSummary.sceneCount} scene{impactSummary.sceneCount !== 1 ? 's' : ''}{' '}
          across {impactSummary.storyCount} stor{impactSummary.storyCount !== 1 ? 'ies' : 'y'}.
        </p>
        <div className={styles.actions}>
          <button ref={confirmRef} type="button" className={styles.confirmButton} onClick={onConfirm}>
            Save and update links
          </button>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
