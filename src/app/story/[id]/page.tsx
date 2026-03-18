'use client';

import { useState, useEffect, useRef, use, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ViewModeSwitch, type ViewMode } from '@/components/ViewModeSwitch/ViewModeSwitch';
import { Corkboard } from '@/components/Corkboard/Corkboard';
import { SaveStatus } from '@/components/SaveStatus/SaveStatus';
import { RecoveryBanner } from '@/components/RecoveryBanner/RecoveryBanner';
import { ErrorBanner } from '@/components/ErrorBanner/ErrorBanner';
import { SubmissionTracker, type SubmissionTrackerHandle } from '@/components/SubmissionTracker/SubmissionTracker';
import { PacingBoard } from '@/components/PacingBoard/PacingBoard';
import { RevisionPassPanel } from '@/components/RevisionPassPanel/RevisionPassPanel';
import { CollabPanel } from '@/components/CollabPanel/CollabPanel';
import { CollabBadge } from '@/components/CollabPanel/CollabBadge';
import { getUnresolvedCount } from '@/lib/collaboration';
import { SharePreviewDialog } from '@/components/SharePreviewDialog/SharePreviewDialog';
import { PreviewFeedbackPanel } from '@/components/PreviewFeedbackPanel/PreviewFeedbackPanel';
import { getUnreadFeedbackCount } from '@/lib/previewLinks';
import { getScenes, updateSceneOrder, updateSceneStatus, addScene, updateSceneFields } from '@/lib/scenes';
import { getStory, updateStory } from '@/lib/stories';
import { clearSnapshot, loadSnapshot } from '@/lib/autosave';
import { useAutosave } from '@/hooks/useAutosave';
import { useFocusMode } from '@/hooks/useFocusMode';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { FocusControls } from '@/components/FocusControls/FocusControls';
import { Tooltip } from '@/components/Tooltip/Tooltip';
import type { Scene, SceneStatus } from '@/types/scene';
import styles from './page.module.css';

interface StoryPageProps {
  params: Promise<{ id: string }>;
}

const CORKBOARD_FILTER_TOOLTIPS = {
  all: 'Show all scenes regardless of status.',
  planned: 'Show only scenes that are planned but not yet drafted.',
  drafting: 'Show only scenes currently being drafted.',
  done: 'Show only completed scenes.',
} as const;

function StoryPageInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'revision' | 'collab' | 'feedback' | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [focusedSceneId, setFocusedSceneId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setLoading] = useState(true);
  const [storyTitle, setStoryTitle] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [showError, setShowError] = useState(false);
  const [corkboardStatusFilter, setCorkboardStatusFilter] = useState<SceneStatus | 'all'>('all');

  const trackerRef = useRef<SubmissionTrackerHandle>(null);

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

  // Load story title from localStorage
  useEffect(() => {
    setStoryTitle(getStory(id)?.title ?? '');
  }, [id]);

  const handleTitleChange = (val: string) => {
    setStoryTitle(val);
    updateStory(id, { title: val });
  };

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

  const handleAddSceneDefault = () => {
    handleAddScene({
      title: 'New Scene',
      chapter: scenes.length > 0 ? scenes[scenes.length - 1].chapter : 'Chapter 1',
      summary: '',
      status: 'planned',
      intent: '',
      pov: '',
    });
  };

  const handleFieldChange = (sceneId: string, field: 'intent' | 'pov', value: string) => {
    updateSceneFields(id, sceneId, { [field]: value });
    refreshScenes();
  };

  const handleSceneJump = (_sceneId: string) => {
    setViewMode('corkboard');
  };

  const unresolvedCollabCount = getUnresolvedCount(id);
  const unreadFeedbackCount = getUnreadFeedbackCount(id);

  const { isFocusMode, typewriterScroll, enterFocus, exitFocus, toggleTypewriter, textareaRef } = useFocusMode();
  const { timerState, elapsedMs, targetMs, startTimer, stopTimer, dismissSummary, wordsWritten } = useSessionTimer();
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const filteredSceneCount = corkboardStatusFilter === 'all'
    ? scenes.length
    : scenes.filter((s) => s.status === corkboardStatusFilter).length;
  const sceneCountLabel =
    corkboardStatusFilter === 'all'
      ? `${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'}`
      : `${filteredSceneCount} of ${scenes.length} scenes`;

  return (
    <div className={styles.page} data-view-mode={viewMode} data-focus-mode={isFocusMode ? 'true' : undefined}>

      {/* SHELL HEADER — persistent across all views */}
      <div className={styles.shellHeader}>
        <input
          type="text"
          className={styles.titleInput}
          placeholder="Untitled Story"
          aria-label="Story title"
          value={storyTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
        <ViewModeSwitch mode={viewMode} onChange={setViewMode} />
        <div className={styles.shellHeaderRight}>
          {viewMode === 'editor' && (
            <SaveStatus saveState={saveState} lastSaved={lastSaved} onRetry={retrySave} />
          )}
          {viewMode === 'corkboard' && (
            <span className={styles.saveStatusText}>
              {saveState === 'saving' && 'Saving…'}
              {(saveState === 'saved' || (saveState === 'idle' && lastSaved)) && lastSaved && 'Saved'}
            </span>
          )}
          {viewMode === 'editor' && (
            <button
              className={styles.sharePreviewBtn}
              onClick={() => setShowShareDialog(true)}
              aria-label="Share preview link"
            >
              Share Preview
            </button>
          )}
        </div>
      </div>

      {/* SHELL TOOLBAR — view-specific actions, fixed min-height */}
      <div className={styles.shellToolbar}>
        {viewMode === 'editor' && !isFocusMode && (
          <Tooltip content="Enter distraction-free writing mode.">
            <button
              type="button"
              className={styles.focusModeButton}
              onClick={enterFocus}
              aria-label="Enter focus mode"
            >
              Focus
            </button>
          </Tooltip>
        )}
        {viewMode === 'corkboard' && (
          <>
            <span className={styles.toolbarSceneCount}>{sceneCountLabel}</span>
            <div className={styles.toolbarFilterGroup} role="group" aria-label="Filter by status">
              {(['all', 'planned', 'drafting', 'done'] as const).map((s) => (
                <Tooltip key={s} content={CORKBOARD_FILTER_TOOLTIPS[s]}>
                  <button
                    className={`${styles.filterBtn} ${corkboardStatusFilter === s ? styles.filterBtnActive : ''}`}
                    onClick={() => setCorkboardStatusFilter(s)}
                    aria-pressed={corkboardStatusFilter === s}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                </Tooltip>
              ))}
            </div>
            <Tooltip content="Add a new scene or story beat to your corkboard.">
              <button className={styles.addBeatBtn} onClick={handleAddSceneDefault} aria-label="Add new scene">
                + Add beat
              </button>
            </Tooltip>
          </>
        )}
        {viewMode === 'submissions' && (
          <button
            className={styles.addSubmissionBtn}
            onClick={() => trackerRef.current?.openAddPanel()}
          >
            Add Submission
          </button>
        )}
      </div>

      {/* SHELL BODY — view canvas */}
      <div className={styles.shellBody}>
        {viewMode === 'editor' && (
          <div className={styles.editorLayout}>
            <div className={styles.editorMain}>
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
                  ref={textareaRef}
                  className={styles.editor}
                  placeholder="Start writing your story..."
                  aria-label="Story content editor"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  data-typewriter-scroll={typewriterScroll && isFocusMode ? 'true' : undefined}
                />
                {isFocusMode && (
                  <FocusControls
                    typewriterScroll={typewriterScroll}
                    onToggleTypewriter={toggleTypewriter}
                    timerState={timerState}
                    elapsedMs={elapsedMs}
                    targetMs={targetMs}
                    onStartTimer={(ms) => startTimer(ms, wordCount)}
                    onStopTimer={stopTimer}
                    onDismissSummary={dismissSummary}
                    wordsWritten={wordsWritten(wordCount)}
                    onExitFocus={exitFocus}
                    saveState={saveState}
                    lastSaved={lastSaved}
                  />
                )}
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
                <button
                  role="tab"
                  id="tab-feedback"
                  aria-selected={sidebarTab === 'feedback'}
                  aria-controls="panel-feedback"
                  className={`${styles.sidebarTab} ${sidebarTab === 'feedback' ? styles.sidebarTabActive : ''} ${styles.sidebarTabWithBadge}`}
                  onClick={() => setSidebarTab('feedback')}
                >
                  Feedback
                  <CollabBadge count={unreadFeedbackCount} />
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
              ) : sidebarTab === 'feedback' ? (
                <div role="tabpanel" id="panel-feedback" aria-labelledby="tab-feedback" className={styles.sidebarPanelFull}>
                  <PreviewFeedbackPanel storyId={id} />
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
            {showShareDialog && (
              <SharePreviewDialog
                storyId={id}
                storyTitle={storyTitle}
                content={content}
                onClose={() => setShowShareDialog(false)}
              />
            )}
          </div>
        )}

        {viewMode === 'corkboard' && (
          <Corkboard
            storyId={id}
            scenes={scenes}
            statusFilter={corkboardStatusFilter}
            loading={scenesLoading}
            onSceneClick={handleSceneClick}
            onReorder={handleSceneReorder}
            onStatusChange={handleSceneStatusChange}
            onAddScene={handleAddScene}
            onFieldChange={handleFieldChange}
          />
        )}

        {viewMode === 'pacing' && (
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
        )}

        {viewMode === 'submissions' && (
          <SubmissionTracker ref={trackerRef} storyId={id} />
        )}
      </div>
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
