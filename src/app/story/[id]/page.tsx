'use client';

import { useState, useEffect, use } from 'react';
import { ViewModeSwitch, type ViewMode } from '@/components/ViewModeSwitch/ViewModeSwitch';
import { Corkboard } from '@/components/Corkboard/Corkboard';
import { SaveStatus } from '@/components/SaveStatus/SaveStatus';
import { RecoveryBanner } from '@/components/RecoveryBanner/RecoveryBanner';
import { ErrorBanner } from '@/components/ErrorBanner/ErrorBanner';
import { getScenes, updateSceneOrder, updateSceneStatus } from '@/lib/scenes';
import { clearSnapshot, loadSnapshot } from '@/lib/autosave';
import { useAutosave } from '@/hooks/useAutosave';
import type { Scene, SceneStatus } from '@/types/scene';
import styles from './page.module.css';

interface StoryPageProps {
  params: Promise<{ id: string }>;
}

export default function StoryPage({ params }: StoryPageProps) {
  const { id } = use(params);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setLoading] = useState(true);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showError, setShowError] = useState(false);

  const {
    content,
    setContent,
    saveState,
    lastSaved,
    error,
    retrySave,
    restoreSnapshot,
    hasRecovery,
  } = useAutosave(id);

  // Show recovery banner if there's an unsaved snapshot
  useEffect(() => {
    if (hasRecovery) setShowRecovery(true);
  }, [hasRecovery]);

  // Show error banner when save fails
  useEffect(() => {
    if (saveState === 'failed') setShowError(true);
  }, [saveState]);

  // Load scenes for corkboard view
  useEffect(() => {
    setLoading(true);
    const loadedScenes = getScenes(id);
    setScenes(loadedScenes);
    setLoading(false);
  }, [id]);

  const refreshScenes = () => {
    const refreshedScenes = getScenes(id);
    setScenes(refreshedScenes);
  };

  const handleSceneClick = (sceneId: string) => {
    console.log('Navigate to scene:', sceneId);
  };

  const handleSceneReorder = (sceneId: string, newOrder: number) => {
    updateSceneOrder(id, sceneId, newOrder);
    refreshScenes();
  };

  const handleSceneStatusChange = (sceneId: string, status: SceneStatus) => {
    updateSceneStatus(id, sceneId, status);
    refreshScenes();
  };

  const handleRestore = () => {
    restoreSnapshot();
    setShowRecovery(false);
  };

  const handleDismissRecovery = () => {
    clearSnapshot(id);
    setShowRecovery(false);
  };

  const handleRetry = async () => {
    await retrySave();
  };

  const handleDismissError = () => {
    setShowError(false);
  };

  const snapshotTimestamp = loadSnapshot(id)?.timestamp ?? Date.now();

  return (
    <div className={styles.page} data-view-mode={viewMode}>
      {viewMode === 'editor' ? (
        <div className={styles.editorLayout}>
          <div className={styles.editorMain}>
            <div className={styles.editorHeader}>
              <input
                type="text"
                className={styles.titleInput}
                placeholder="Untitled Story"
                aria-label="Story title"
                defaultValue={`Story ${id}`}
              />
              <ViewModeSwitch mode={viewMode} onChange={setViewMode} />
              <SaveStatus saveState={saveState} lastSaved={lastSaved} onRetry={retrySave} />
            </div>
            <div className={styles.editorCanvas}>
              {showRecovery && (
                <div className={styles.bannerContainer}>
                  <RecoveryBanner
                    snapshotTimestamp={snapshotTimestamp}
                    onRestore={handleRestore}
                    onDismiss={handleDismissRecovery}
                  />
                </div>
              )}
              {showError && (
                <div className={styles.bannerContainer}>
                  <ErrorBanner
                    error={error ?? 'Unknown error'}
                    onRetry={handleRetry}
                    onDismiss={handleDismissError}
                  />
                </div>
              )}
              <label htmlFor="story-editor" className={styles.visuallyHidden}>
                Story content editor
              </label>
              <textarea
                id="story-editor"
                className={styles.editor}
                placeholder="Start writing your story..."
                aria-label="Story content editor"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>Notes</h3>
              <div className={styles.sidebarPlaceholder}>
                <p className={styles.placeholderText}>
                  Notes and outline will appear here
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className={styles.corkboardLayout}>
          <div className={styles.corkboardHeader}>
            <input
              type="text"
              className={styles.titleInput}
              placeholder="Untitled Story"
              aria-label="Story title"
              defaultValue={`Story ${id}`}
            />
            <ViewModeSwitch mode={viewMode} onChange={setViewMode} />
            <span className={styles.corkboardSaveStatus}>
              {saveState === 'saving' && 'Saving…'}
              {(saveState === 'saved' || (saveState === 'idle' && lastSaved)) && lastSaved && `Saved`}
            </span>
          </div>
          <Corkboard
            scenes={scenes}
            loading={scenesLoading}
            onSceneClick={handleSceneClick}
            onReorder={handleSceneReorder}
            onStatusChange={handleSceneStatusChange}
          />
        </div>
      )}
    </div>
  );
}
