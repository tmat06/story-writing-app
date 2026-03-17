'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { VersionEntry } from '@/lib/versions';
import { VersionEntryRow } from './VersionEntry';
import { VersionPreview } from './VersionPreview';
import styles from './VersionHistory.module.css';

interface VersionHistoryProps {
  versions: VersionEntry[];
  onRestore: (versionId: string) => void;
  onSaveNamedDraft: (label: string) => void;
  onClose: () => void;
}

export function VersionHistory({ versions, onRestore, onSaveNamedDraft, onClose }: VersionHistoryProps) {
  const [previewEntry, setPreviewEntry] = useState<VersionEntry | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSaveDraft = useCallback(() => {
    if (!draftLabel.trim()) return;
    onSaveNamedDraft(draftLabel);
    setDraftLabel('');
  }, [draftLabel, onSaveNamedDraft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSaveDraft();
  };

  return (
    <aside
      role="complementary"
      aria-label="Draft History"
      className={styles.panel}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Draft History</h2>
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close draft history"
        >
          ✕
        </button>
      </div>

      {previewEntry ? (
        <VersionPreview
          entry={previewEntry}
          onRestore={(id) => {
            onRestore(id);
            setPreviewEntry(null);
          }}
          onClose={() => setPreviewEntry(null)}
        />
      ) : (
        <>
          <div role="list" className={styles.versionList}>
            {versions.length === 0 ? (
              <p className={styles.emptyState}>No checkpoints yet — keep writing!</p>
            ) : (
              versions.map((entry) => (
                <VersionEntryRow
                  key={entry.id}
                  entry={entry}
                  onPreview={setPreviewEntry}
                  onRestore={onRestore}
                />
              ))
            )}
          </div>
          <div className={styles.nameDraftSection}>
            <input
              type="text"
              className={styles.nameDraftInput}
              placeholder="Name this draft…"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Draft name"
            />
            <button
              type="button"
              className={styles.nameDraftButton}
              onClick={handleSaveDraft}
              disabled={!draftLabel.trim()}
            >
              Save draft
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
