'use client';

import { useState, useEffect, use } from 'react';
import { ViewModeSwitch, type ViewMode } from '@/components/ViewModeSwitch/ViewModeSwitch';
import { Corkboard } from '@/components/Corkboard/Corkboard';
import { SaveStatus } from '@/components/SaveStatus/SaveStatus';
import { RecoveryBanner } from '@/components/RecoveryBanner/RecoveryBanner';
import { ErrorBanner } from '@/components/ErrorBanner/ErrorBanner';
import { SubmissionTracker } from '@/components/SubmissionTracker/SubmissionTracker';
import { CollabPanel } from '@/components/CollabPanel/CollabPanel';
import { CollabBadge } from '@/components/CollabPanel/CollabBadge';
import { getScenes, updateSceneOrder, updateSceneStatus, addScene, updateSceneFields } from '@/lib/scenes';
import { clearSnapshot, loadSnapshot } from '@/lib/autosave';
import { getUnresolvedCount } from '@/lib/collaboration';
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
  const [storyTitle, setStoryTitle] = useState(`Story ${id}`);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showError, setShowError] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'collab'>('notes');
  const [unresolvedCount, setUnresolvedCount] = useState(() => getUnresolvedCount(id));

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

  const handleAddScene = (scene: Omit<Scene, 'id' | 'order'>) => {
    addScene(id, scene);
    refreshScenes();
  };

  const handleFieldChange = (sceneId: string, field: 'intent' | 'pov', value: string) => {
    updateSceneFields(id, sceneId, { [field]: value });
    refreshScenes();
  };

  const handleSceneJump = (sceneId: string | null) => {
    setViewMode('corkboard');
    console.log('Collab: jump to scene', sceneId);
  };

  const refreshUnresolved = () => {
    setUnresolvedCount(getUnresolvedCount(id));
  };

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
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
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
            <div className={styles.sidebarTabs}>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === 'notes' ? styles.sidebarTabActive : ''}`}
                onClick={() => setSidebarTab('notes')}
                aria-pressed={sidebarTab === 'notes'}
              >
                Notes
              </button>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === 'collab' ? styles.sidebarTabActive : ''}`}
                onClick={() => { setSidebarTab('collab'); refreshUnresolved(); }}
                aria-pressed={sidebarTab === 'collab'}
                aria-label={`Collaboration${unresolvedCount > 0 ? `, ${unresolvedCount} unresolved` : ''}`}
              >
                Collab
                <CollabBadge count={unresolvedCount} />
              </button>
            </div>
            {sidebarTab === 'notes' ? (
              <div className={styles.sidebarSection}>
                <div className={styles.sidebarPlaceholder}>
                  <p className={styles.placeholderText}>
                    Notes and outline will appear here
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.collabPanelContainer}>
                <CollabPanel
                  storyId={id}
                  scenes={scenes}
                  onSceneJump={handleSceneJump}
                />
              </div>
            )}
          </aside>
        </div>
      ) : viewMode === 'corkboard' ? (
        <div className={styles.corkboardLayout}>
          <div className={styles.corkboardHeader}>
            <input
              type="text"
              className={styles.titleInput}
              placeholder="Untitled Story"
              aria-label="Story title"
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
            />
            <ViewModeSwitch mode={viewMode} onChange={setViewMode} />
            <span className={styles.corkboardSaveStatus}>
              {saveState === 'saving' && 'Saving…'}
              {(saveState === 'saved' || (saveState === 'idle' && lastSaved)) && lastSaved && `Saved`}
            </span>
          </div>
          <Corkboard
            storyId={id}
            scenes={scenes}
            loading={scenesLoading}
            onSceneClick={handleSceneClick}
            onReorder={handleSceneReorder}
            onStatusChange={handleSceneStatusChange}
            onAddScene={handleAddScene}
            onFieldChange={handleFieldChange}
          />
        </div>
      ) : (
        <div className={styles.submissionsLayout}>
          <SubmissionTracker
            storyId={id}
            storyTitle={storyTitle}
            onTitleChange={setStoryTitle}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      )}
    </div>
  );
}
