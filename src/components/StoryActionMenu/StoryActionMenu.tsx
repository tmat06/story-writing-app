'use client';

import { useState, useRef, useEffect } from 'react';
import { updateStory, deleteStory } from '@/lib/stories';
import { Series } from '@/types/series';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './StoryActionMenu.module.css';

interface StoryActionMenuProps {
  storyId: string;
  storyTitle: string;
  isArchived: boolean;
  seriesId?: string;
  availableSeries: Series[];
  onUpdate: () => void;
  onAssignToSeries?: (seriesId: string) => void;
  onRemoveFromSeries?: () => void;
}

export default function StoryActionMenu({
  storyId,
  storyTitle,
  isArchived,
  seriesId,
  availableSeries,
  onUpdate,
  onAssignToSeries,
  onRemoveFromSeries,
}: StoryActionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showSeriesPicker, setShowSeriesPicker] = useState(false);
  const [newTitle, setNewTitle] = useState(storyTitle);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowSeriesPicker(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const handleRename = () => {
    if (newTitle.trim()) {
      updateStory(storyId, { title: newTitle.trim() });
      onUpdate();
    }
    setRenameDialogOpen(false);
    setMenuOpen(false);
  };

  const handleArchiveToggle = () => {
    updateStory(storyId, { isArchived: !isArchived });
    onUpdate();
    setMenuOpen(false);
  };

  const handleDelete = () => {
    deleteStory(storyId);
    onUpdate();
    setDeleteDialogOpen(false);
    setMenuOpen(false);
  };

  const handleAssignToSeries = (sid: string) => {
    updateStory(storyId, { seriesId: sid });
    onAssignToSeries?.(sid);
    onUpdate();
    setShowSeriesPicker(false);
    setMenuOpen(false);
  };

  const handleRemoveFromSeries = () => {
    updateStory(storyId, { seriesId: undefined });
    onRemoveFromSeries?.();
    onUpdate();
    setMenuOpen(false);
  };

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={styles.menuButton}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
          setShowSeriesPicker(false);
        }}
        aria-label={`Actions for ${storyTitle}`}
      >
        ···
      </button>

      {menuOpen && (
        <div className={styles.dropdown}>
          <button
            className={styles.menuItem}
            onClick={(e) => {
              e.stopPropagation();
              setNewTitle(storyTitle);
              setRenameDialogOpen(true);
              setMenuOpen(false);
            }}
          >
            Rename
          </button>
          <button
            className={styles.menuItem}
            onClick={(e) => {
              e.stopPropagation();
              handleArchiveToggle();
            }}
          >
            {isArchived ? 'Unarchive' : 'Archive'}
          </button>

          {seriesId ? (
            <button
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFromSeries();
              }}
            >
              Remove from series
            </button>
          ) : (
            <>
              {showSeriesPicker ? (
                <div className={styles.seriesPickerInline} onClick={e => e.stopPropagation()}>
                  {availableSeries.length === 0 ? (
                    <span className={styles.seriesPickerDisabled}>Create a series first</span>
                  ) : (
                    availableSeries.map(s => (
                      <button
                        key={s.id}
                        className={styles.seriesPickerItem}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignToSeries(s.id);
                        }}
                      >
                        {s.title}
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <button
                  className={styles.menuItem}
                  disabled={availableSeries.length === 0}
                  title={availableSeries.length === 0 ? 'Create a series first' : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSeriesPicker(true);
                  }}
                >
                  Add to series
                </button>
              )}
            </>
          )}

          <button
            className={styles.menuItem}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialogOpen(true);
              setMenuOpen(false);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {renameDialogOpen && (
        <div
          className={styles.renameOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setRenameDialogOpen(false);
          }}
        >
          <div
            className={styles.renameDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.renameTitle}>Rename Story</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={styles.renameInput}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setRenameDialogOpen(false);
              }}
            />
            <div className={styles.renameActions}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameDialogOpen(false);
                }}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRename();
                }}
                className={styles.confirmButton}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Story"
        message={`Are you sure you want to delete "${storyTitle}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        destructive={true}
      />
    </div>
  );
}
