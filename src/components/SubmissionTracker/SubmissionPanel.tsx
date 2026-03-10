'use client';

import { useEffect, useRef, useState } from 'react';
import type { SubmissionEntry, SubmissionStatus, ResponseType } from '@/types/submission';
import styles from './SubmissionPanel.module.css';

const STATUS_OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: 'drafting', label: 'Drafting' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'requested_revisions', label: 'Requested Revisions' },
  { value: 'closed', label: 'Closed' },
];

const RESPONSE_TYPE_OPTIONS: { value: ResponseType; label: string }[] = [
  { value: 'full_request', label: 'Full Request' },
  { value: 'partial_request', label: 'Partial Request' },
  { value: 'rejection', label: 'Rejection' },
  { value: 'no_response', label: 'No Response' },
  { value: 'offer', label: 'Offer' },
  { value: 'other', label: 'Other' },
];

interface SubmissionPanelProps {
  entry: SubmissionEntry | null;
  onSave: (entry: SubmissionEntry) => void;
  onClose: () => void;
  onArchive?: (id: string) => void;
  storyId: string;
}

type FormState = Omit<SubmissionEntry, 'id' | 'storyId' | 'createdAt' | 'updatedAt'>;

function emptyForm(): FormState {
  return {
    recipientName: '',
    channelType: '',
    status: 'drafting',
    sentDate: null,
    responseDate: null,
    responseType: null,
    nextActionDate: null,
    notes: '',
    linkedArtifactId: null,
    archivedAt: null,
  };
}

export function SubmissionPanel({ entry, onSave, onClose, onArchive, storyId }: SubmissionPanelProps) {
  const isEdit = entry !== null;
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(entry ? { ...entry } : emptyForm());
  const [recipientError, setRecipientError] = useState(false);

  // Sync form when entry changes (switching between entries)
  useEffect(() => {
    setForm(entry ? { ...entry } : emptyForm());
    setRecipientError(false);
  }, [entry]);

  // Auto-focus first field on open
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Esc key closes panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.recipientName.trim()) {
      setRecipientError(true);
      firstFieldRef.current?.focus();
      return;
    }

    const now = new Date().toISOString();
    const saved: SubmissionEntry = isEdit
      ? {
          ...entry,
          ...form,
          updatedAt: now,
        }
      : {
          ...form,
          id: crypto.randomUUID(),
          storyId,
          createdAt: now,
          updatedAt: now,
        };

    onSave(saved);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick} aria-modal="true">
      <aside className={styles.panel} role="dialog" aria-label={isEdit ? 'Edit submission' : 'Add submission'}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{isEdit ? 'Edit Submission' : 'Add Submission'}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close submission panel"
          >
            ✕
          </button>
        </div>

        <div className={styles.panelBody}>
          <div className={styles.field}>
            <label htmlFor="recipientName" className={styles.label}>
              Recipient <span className={styles.required}>*</span>
            </label>
            <input
              id="recipientName"
              ref={firstFieldRef}
              type="text"
              className={`${styles.input} ${recipientError ? styles.inputError : ''}`}
              value={form.recipientName}
              onChange={(e) => {
                setField('recipientName', e.target.value);
                if (recipientError) setRecipientError(false);
              }}
              placeholder="Agent, contest, or beta reader name"
              aria-required="true"
              aria-invalid={recipientError}
            />
            {recipientError && (
              <span className={styles.errorMessage}>Recipient name is required</span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="channelType" className={styles.label}>
              Channel / Type
            </label>
            <input
              id="channelType"
              type="text"
              className={styles.input}
              value={form.channelType}
              onChange={(e) => setField('channelType', e.target.value)}
              placeholder="e.g. Agent Query, Contest, Beta Reader"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="status" className={styles.label}>
              Status
            </label>
            <select
              id="status"
              className={styles.select}
              value={form.status}
              onChange={(e) => setField('status', e.target.value as SubmissionStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="sentDate" className={styles.label}>
                Sent Date
              </label>
              <input
                id="sentDate"
                type="date"
                className={styles.input}
                value={form.sentDate ?? ''}
                onChange={(e) => setField('sentDate', e.target.value || null)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="responseDate" className={styles.label}>
                Response Date
              </label>
              <input
                id="responseDate"
                type="date"
                className={styles.input}
                value={form.responseDate ?? ''}
                onChange={(e) => setField('responseDate', e.target.value || null)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="responseType" className={styles.label}>
              Response Type
            </label>
            <select
              id="responseType"
              className={styles.select}
              value={form.responseType ?? ''}
              onChange={(e) =>
                setField('responseType', (e.target.value as ResponseType) || null)
              }
            >
              <option value="">— None —</option>
              {RESPONSE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="nextActionDate" className={styles.label}>
              Next Action Date
            </label>
            <input
              id="nextActionDate"
              type="date"
              className={styles.input}
              value={form.nextActionDate ?? ''}
              onChange={(e) => setField('nextActionDate', e.target.value || null)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="linkedArtifactId" className={styles.label}>
              Package / Snapshot ID
            </label>
            <input
              id="linkedArtifactId"
              type="text"
              className={styles.input}
              value={form.linkedArtifactId ?? ''}
              onChange={(e) => setField('linkedArtifactId', e.target.value || null)}
              placeholder="Optional — reference to export or snapshot"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="notes" className={styles.label}>
              Notes
            </label>
            <textarea
              id="notes"
              className={styles.textarea}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Any additional context..."
              rows={4}
            />
          </div>
        </div>

        <div className={styles.panelFooter}>
          {isEdit && onArchive && (
            <button
              type="button"
              className={styles.archiveButton}
              onClick={() => {
                onArchive(entry.id);
                onClose();
              }}
            >
              Archive
            </button>
          )}
          <div className={styles.footerActions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={styles.saveButton} onClick={handleSave}>
              {isEdit ? 'Save Changes' : 'Add Submission'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
