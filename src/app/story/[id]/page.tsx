'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ViewModeSwitch, type ViewMode } from '@/components/ViewModeSwitch/ViewModeSwitch';
import { Corkboard } from '@/components/Corkboard/Corkboard';
import { SaveStatus } from '@/components/SaveStatus/SaveStatus';
import { RecoveryBanner } from '@/components/RecoveryBanner/RecoveryBanner';
import { ErrorBanner } from '@/components/ErrorBanner/ErrorBanner';
import { SubmissionTracker } from '@/components/SubmissionTracker/SubmissionTracker';
import { PacingBoard } from '@/components/PacingBoard/PacingBoard';
import { RevisionPassPanel } from '@/components/RevisionPassPanel/RevisionPassPanel';
import { CollabPanel } from '@/components/CollabPanel/CollabPanel';
import { CollabBadge } from '@/components/CollabPanel/CollabBadge';
import { getUnresolvedCount } from '@/lib/collaboration';
import { getScenes, updateSceneOrder, updateSceneStatus, addScene, updateSceneFields } from '@/lib/scenes';
import { clearSnapshot, loadSnapshot } from '@/lib/autosave';
import { useAutosave } from '@/hooks/useAutosave';
import type { Scene, SceneStatus } from '@/types/scene';
import styles from './page.module.css';

interface StoryPageProps {
  params: Promise<{ id: string }>;
}

function StoryPageInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'revision' | 'collab' | null>(null);
  const [focusedSceneId, setFocusedSceneId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setLoading] = useState(true);
  const [storyTitle, setStoryTitle] = useState(`Story ${id}`);
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

  // Read query params on mount to set initial view and focused scene
  useEffect(() => {
    const view = searchParams.get('view') as ViewMode | null;
    const scene = searchParams.get('scene');
    if (view && ['editor', 'corkboard', 'submissions', 'pacing'].includes(view)) {
      setViewMode(view);
    }
    if (scene) {
      setFocusedSceneId(scene);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

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
    router.push(`/story/${id}?view=editor&scene=${sceneId}`);
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

  const handleSceneJump = (_sceneId: string) => {
    setViewMode('corkboard');
  };

  const unresolvedCollabCount = getUnresolvedCount(id);

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
          <aside className={`${styles.sidebar} ${sidebarTab ? styles.sidebarOpen : ''}`}>
            <div className={styles.sidebarTabBar} role="tablist" aria-label="Sidebar panels">
              <button
                role="tab"
                id="tab-notes"
                aria-selected={sidebarTab === 'notes'}
                aria-controls="panel-notes"
                className={`${styles.sidebarTab} ${sidebarTab === 'notes' ? styles.sidebarTabActive : ''}`}
                onClick={() => setSidebarTab('notes')}
              >
                Notes
              </button>
              <button
                role="tab"
                id="tab-revision"
                aria-selected={sidebarTab === 'revision'}
                aria-controls="panel-revision"
                className={`${styles.sidebarTab} ${sidebarTab === 'revision' ? styles.sidebarTabActive : ''}`}
                onClick={() => setSidebarTab('revision')}
              >
                Revision
              </button>
              <button
                role="tab"
                id="tab-collab"
                aria-selected={sidebarTab === 'collab'}
                aria-controls="panel-collab"
                className={`${styles.sidebarTab} ${sidebarTab === 'collab' ? styles.sidebarTabActive : ''} ${styles.sidebarTabWithBadge}`}
                onClick={() => setSidebarTab('collab')}
              >
                Collab
                <CollabBadge count={unresolvedCollabCount} />
              </button>
            </div>
            {sidebarTab === 'notes' ? (
              <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" className={styles.sidebarSection}>
                <div className={styles.sidebarPlaceholder}>
                  <p className={styles.placeholderText}>
                    Notes and outline will appear here
                  </p>
                </div>
              </div>
            ) : sidebarTab === 'revision' ? (
              <div role="tabpanel" id="panel-revision" aria-labelledby="tab-revision" className={styles.sidebarPanelFull}>
                <RevisionPassPanel
                  storyId={id}
                  storyTitle={storyTitle}
                  scenes={scenes}
                  onSceneJump={handleSceneJump}
                />
              </div>
            ) : (
              <div role="tabpanel" id="panel-collab" aria-labelledby="tab-collab" className={styles.sidebarPanelFull}>
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
      ) : viewMode === 'pacing' ? (
        <div className={styles.pacingLayout}>
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
          </div>
          <div className={styles.pacingContainer}>
            <PacingBoard
              storyId={id}
              scenes={scenes}
              onJumpToScene={(sceneId) => {
                setFocusedSceneId(sceneId);
                setViewMode('corkboard');
              }}
            />
          </div>
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

export default function StoryPage({ params }: StoryPageProps) {
  const { id } = use(params);
  return (
    <Suspense>
      <StoryPageInner id={id} />
    </Suspense>
  );
}
