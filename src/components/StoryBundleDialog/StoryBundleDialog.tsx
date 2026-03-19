'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { parseBundle, importBundle } from '@/lib/bundle';
import type { BundleParseResult } from '@/types/bundle';
import styles from './StoryBundleDialog.module.css';

interface StoryBundleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (newStoryId: string) => void;
}

type ParseState = 'idle' | 'parsing' | 'ready' | 'error';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function errorMessage(result: Extract<BundleParseResult, { ok: false }>): {
  main: string;
  hint: string;
} {
  switch (result.error) {
    case 'corrupt':
      return { main: 'File could not be verified.', hint: 'Choose a different file and try again.' };
    case 'incompatible_version':
      return {
        main: result.detail ?? 'Incompatible bundle version.',
        hint: 'This version is not supported.',
      };
    case 'checksum_mismatch':
      return {
        main: 'File integrity check failed.',
        hint: 'The file may be corrupted. Try re-exporting.',
      };
    case 'missing_assets':
      return {
        main: result.detail ?? 'Required bundle fields are missing.',
        hint: 'The file may be incomplete.',
      };
  }
}

export default function StoryBundleDialog({
  isOpen,
  onClose,
  onImportComplete,
}: StoryBundleDialogProps) {
  const [parseState, setParseState] = useState<ParseState>('idle');
  const [parseResult, setParseResult] = useState<BundleParseResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveRegionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state on each open
      setParseState('idle');
      setParseResult(null);
      setSelectedFileName(null);
      setIsImporting(false);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleFile = useCallback(async (file: File) => {
    setSelectedFileName(file.name);
    setParseState('parsing');
    setParseResult(null);
    if (liveRegionRef.current) liveRegionRef.current.textContent = 'Verifying bundle integrity…';

    const result = await parseBundle(file);
    setParseResult(result);
    setParseState(result.ok ? 'ready' : 'error');
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = result.ok
        ? 'File accepted. Ready to import.'
        : 'File rejected. See error details.';
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected after clearing
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => setIsDragActive(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    if (!parseResult?.ok) return;
    setIsImporting(true);
    const newStoryId = importBundle(parseResult.bundle);
    onImportComplete(newStoryId);
  };

  if (!isOpen) return null;

  const readyResult = parseResult?.ok ? parseResult : null;
  const errorResult = parseResult && !parseResult.ok ? parseResult : null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bundle-dialog-title"
      >
        {/* Hidden live region for file parse status */}
        <span
          ref={liveRegionRef}
          aria-live="polite"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
        />

        <div className={styles.header}>
          <h2
            id="bundle-dialog-title"
            className={styles.title}
            ref={titleRef}
            tabIndex={-1}
          >
            Import Story Bundle
          </h2>
          <p className={styles.subtitle}>
            Restore a full story including structure, notes, and worldbuilding links.
          </p>
        </div>

        <div className={styles.body}>
          {/* Dropzone */}
          <div>
            <p className={styles.sectionLabel}>Choose file</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".storybundle,.json"
              className={styles.fileInput}
              id="bundle-file-input"
              onChange={handleFileChange}
              aria-label="Choose story bundle file"
            />
            <label
              htmlFor="bundle-file-input"
              className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFileName ? (
                <p className={styles.dropzoneFileName}>{selectedFileName}</p>
              ) : (
                <p className={styles.dropzoneHint}>
                  Drag and drop a .storybundle file, or
                </p>
              )}
              <span className={styles.chooseButton} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}>
                {selectedFileName ? 'Choose different file' : 'Choose file'}
              </span>
            </label>
          </div>

          {/* Parsing state */}
          {parseState === 'parsing' && (
            <div className={styles.integrityNotice}>
              <div className={styles.parsingMessage}>
                <span className={styles.spinner} aria-hidden="true" />
                Verifying bundle integrity…
              </div>
            </div>
          )}

          {/* Summary card */}
          {parseState === 'ready' && readyResult && (
            <div className={styles.summaryCard}>
              <p className={styles.sectionLabel}>Story details</p>
              <div className={styles.metaGrid}>
                <span className={styles.metaLabel}>Story name</span>
                <span className={styles.metaValue}>{readyResult.bundle.story.title}</span>

                <span className={styles.metaLabel}>Last updated</span>
                <span className={styles.metaValue}>{formatDate(readyResult.bundle.story.updatedAt)}</span>

                <span className={styles.metaLabel}>Schema version</span>
                <span className={styles.metaValue}>{readyResult.bundle.schemaVersion}</span>

                <span className={styles.metaLabel}>Scenes</span>
                <span className={styles.metaValue}>{readyResult.assetCounts.scenes}</span>

                <span className={styles.metaLabel}>Notes</span>
                <span className={styles.metaValue}>{readyResult.assetCounts.notes}</span>

                <span className={styles.metaLabel}>Revision passes</span>
                <span className={styles.metaValue}>{readyResult.assetCounts.revisionPasses}</span>
              </div>
            </div>
          )}

          {/* Integrity error */}
          {parseState === 'error' && errorResult && (() => {
            const msg = errorMessage(errorResult);
            return (
              <div className={styles.integrityNotice} role="alert">
                <p className={styles.integrityMessage}>{msg.main}</p>
                <p className={styles.integrityHint}>{msg.hint}</p>
              </div>
            );
          })()}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose} disabled={isImporting}>
            Cancel
          </button>
          <button
            className={styles.importButton}
            onClick={handleImport}
            disabled={parseState !== 'ready' || isImporting}
          >
            {isImporting ? 'Importing…' : 'Import bundle'}
          </button>
        </div>
      </div>
    </div>
  );
}
