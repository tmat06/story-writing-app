'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CanonEntity, SceneEntityLink } from '@/types/series';
import { Story } from '@/types/story';
import { Scene } from '@/types/scene';
import { getScenes } from '@/lib/scenes';
import { getStory } from '@/lib/stories';
import styles from './SceneLinkDialog.module.css';

interface SceneLinkDialogProps {
  open: boolean;
  entity: CanonEntity;
  seriesStories: Story[];
  existingLinks: SceneEntityLink[];
  onLink: (storyId: string, sceneId: string) => void;
  onUnlink: (linkId: string) => void;
  onClose: () => void;
}

export default function SceneLinkDialog({
  open,
  entity,
  seriesStories,
  existingLinks,
  onLink,
  onClose,
  onUnlink,
}: SceneLinkDialogProps) {
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
  }, [open, onClose]);

  useEffect(() => {
    if (selectedStoryId) {
      const storyScenes = getScenes(selectedStoryId);
      setScenes(storyScenes);
      setSelectedSceneId('');
    } else {
      setScenes([]);
      setSelectedSceneId('');
    }
  }, [selectedStoryId]);

  const linkedSceneIds = new Set(
    existingLinks.filter(l => l.storyId === selectedStoryId).map(l => l.sceneId)
  );
  const availableScenes = scenes.filter(s => !linkedSceneIds.has(s.id));

  const handleAddLink = () => {
    if (!selectedStoryId || !selectedSceneId) return;
    onLink(selectedStoryId, selectedSceneId);
    setSelectedSceneId('');
  };

  const getStoryTitle = (storyId: string) => {
    const story = seriesStories.find(s => s.id === storyId);
    return story?.title ?? getStory(storyId)?.title ?? 'Unknown story';
  };

  const getSceneLabel = (storyId: string, sceneId: string) => {
    const storyScenes = getScenes(storyId);
    const scene = storyScenes.find(s => s.id === sceneId);
    if (!scene) return `Scene ${sceneId.slice(0, 8)}…`;
    const index = storyScenes.findIndex(s => s.id === sceneId);
    return scene.title || `Scene ${index + 1}`;
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-link-dialog-title"
      >
        <div className={styles.header}>
          <h2 id="scene-link-dialog-title" className={styles.title}>
            Link <strong>{entity.name}</strong> to a scene
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.linkForm}>
            <div className={styles.formRow}>
              <label htmlFor="story-picker" className={styles.label}>Story</label>
              <select
                id="story-picker"
                className={styles.select}
                value={selectedStoryId}
                onChange={e => setSelectedStoryId(e.target.value)}
              >
                <option value="">Select a story…</option>
                {seriesStories.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>

            {selectedStoryId && (
              <div className={styles.formRow}>
                <label htmlFor="scene-picker" className={styles.label}>Scene</label>
                <select
                  id="scene-picker"
                  className={styles.select}
                  value={selectedSceneId}
                  onChange={e => setSelectedSceneId(e.target.value)}
                  disabled={availableScenes.length === 0}
                >
                  <option value="">
                    {scenes.length === 0
                      ? 'No scenes in this story'
                      : availableScenes.length === 0
                      ? 'All scenes already linked'
                      : 'Select a scene…'}
                  </option>
                  {availableScenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.title || `Scene ${scenes.indexOf(scene) + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className={styles.addLinkButton}
              onClick={handleAddLink}
              disabled={!selectedStoryId || !selectedSceneId}
            >
              Add link
            </button>
          </div>

          {existingLinks.length > 0 && (
            <div className={styles.existingLinks}>
              <h3 className={styles.existingLinksTitle}>Existing links</h3>
              <ul className={styles.linkList}>
                {existingLinks.map(link => (
                  <li key={link.id} className={styles.linkItem}>
                    <span className={styles.linkLabel}>
                      {getStoryTitle(link.storyId)} → {getSceneLabel(link.storyId, link.sceneId)}
                    </span>
                    <button
                      type="button"
                      className={styles.unlinkButton}
                      onClick={() => onUnlink(link.id)}
                      aria-label={`Unlink from ${getStoryTitle(link.storyId)}`}
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
