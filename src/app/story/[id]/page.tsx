"use client";

import { useState, useEffect, useRef, useCallback, use, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ViewModeSwitch,
  type ViewMode,
} from "@/components/ViewModeSwitch/ViewModeSwitch";
import { Corkboard } from "@/components/Corkboard/Corkboard";
import { SaveStatus } from "@/components/SaveStatus/SaveStatus";
import { RecoveryBanner } from "@/components/RecoveryBanner/RecoveryBanner";
import { ErrorBanner } from "@/components/ErrorBanner/ErrorBanner";
import {
  SubmissionTracker,
  type SubmissionTrackerHandle,
} from "@/components/SubmissionTracker/SubmissionTracker";
import { PacingBoard } from "@/components/PacingBoard/PacingBoard";
import { DiagnosticsBoard } from "@/components/DiagnosticsBoard/DiagnosticsBoard";
import { RevisionPassPanel } from "@/components/RevisionPassPanel/RevisionPassPanel";
import { CollabPanel } from "@/components/CollabPanel/CollabPanel";
import { NotesPanel } from "@/components/NotesPanel/NotesPanel";
import { CollabBadge } from "@/components/CollabPanel/CollabBadge";
import { getUnresolvedCount } from "@/lib/collaboration";
import { SharePreviewDialog } from "@/components/SharePreviewDialog/SharePreviewDialog";
import { PreviewFeedbackPanel } from "@/components/PreviewFeedbackPanel/PreviewFeedbackPanel";
import { getUnreadFeedbackCount } from "@/lib/previewLinks";
import {
  getScenes,
  updateSceneOrder,
  updateSceneStatus,
  addScene,
  updateSceneFields,
} from "@/lib/scenes";
import { getStory, updateStory } from "@/lib/stories";
import { clearSnapshot, loadSnapshot } from "@/lib/autosave";
import { useAutosave } from "@/hooks/useAutosave";
import { useResumeState } from "@/hooks/useResumeState";
import { resolveSceneId, clampCursor } from "@/lib/resumeState";
import { ResumeIndicator } from "@/components/ResumeIndicator/ResumeIndicator";
import { useFocusMode } from "@/hooks/useFocusMode";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import { useWriterPrefs } from "@/hooks/useWriterPrefs";
import { FocusControls } from "@/components/FocusControls/FocusControls";
import { Tooltip } from "@/components/Tooltip/Tooltip";
import type { Scene, SceneStatus } from "@/types/scene";
import styles from "./page.module.css";

interface StoryPageProps {
  params: Promise<{ id: string }>;
}

const CORKBOARD_FILTER_TOOLTIPS = {
  all: "Show all scenes regardless of status.",
  planned: "Show only scenes that are planned but not yet drafted.",
  drafting: "Show only scenes currently being drafted.",
  done: "Show only completed scenes.",
} as const;

function StoryPageInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [sidebarTab, setSidebarTab] = useState<
    "notes" | "revision" | "collab" | "feedback" | null
  >(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [focusedSceneId, setFocusedSceneId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setLoading] = useState(true);
  const [storyTitle, setStoryTitle] = useState("");
  const [storySeriesId, setStorySeriesId] = useState<string | undefined>(undefined);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showResumeIndicator, setShowResumeIndicator] = useState(false);
  const [corkboardStatusFilter, setCorkboardStatusFilter] = useState<
    SceneStatus | "all"
  >("all");

  const trackerRef = useRef<SubmissionTrackerHandle>(null);
  const restoredRef = useRef(false);

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

  const { loadRestore, scheduleUpdate, optOut, setOptOut } = useResumeState(id);

  // Load story title and seriesId from localStorage
  useEffect(() => {
    const story = getStory(id);
    setStoryTitle(story?.title ?? "");
    setStorySeriesId(story?.seriesId);
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
    if (saveState === "failed") setShowError(true);
  }, [saveState]);

  // Read query params on mount to set initial view and focused scene
  useEffect(() => {
    const view = searchParams.get("view") as ViewMode | null;
    const scene = searchParams.get("scene");
    if (
      view &&
      ["editor", "corkboard", "submissions", "pacing", "diagnostics"].includes(view)
    ) {
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

  // Restore resume state after scenes and content are loaded
  useEffect(() => {
    // Skip if URL explicitly specifies a scene (explicit navigation takes precedence)
    if (searchParams.get("scene")) return;
    if (restoredRef.current || scenesLoading || content === undefined) return;
    restoredRef.current = true;

    const restore = loadRestore();
    if (!restore) return;

    const validSceneId = resolveSceneId(restore.sceneId, scenes.map((s) => s.id));
    if (validSceneId) {
      setFocusedSceneId(validSceneId);
    }

    const validModes: ViewMode[] = ["editor", "corkboard", "submissions", "pacing", "diagnostics"];
    if (validModes.includes(restore.viewMode as ViewMode)) {
      setViewMode(restore.viewMode as ViewMode);
    }

    if (restore.viewMode === "editor" && textareaRef.current) {
      const pos = clampCursor(restore.cursorPosition, textareaRef.current.value.length);
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      });
    }

    setShowResumeIndicator(true);
    if (process.env.NODE_ENV === "development") {
      console.debug("[resume] restored", { storyId: id, sceneId: validSceneId, cursorPosition: restore.cursorPosition, viewMode: restore.viewMode });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, scenesLoading, content]);

  const refreshScenes = () => {
    const refreshedScenes = getScenes(id);
    setScenes(refreshedScenes);
  };

  const handleCursorChange = useCallback(() => {
    if (!textareaRef.current) return;
    scheduleUpdate({
      sceneId: focusedSceneId ?? null,
      cursorPosition: textareaRef.current.selectionStart,
      viewMode,
    });
  }, [focusedSceneId, viewMode, scheduleUpdate]);

  const handleSceneClick = (sceneId: string) => {
    scheduleUpdate({
      sceneId,
      cursorPosition: textareaRef.current?.selectionStart ?? 0,
      viewMode: "editor",
    });
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

  const handleAddScene = (scene: Omit<Scene, "id" | "order">) => {
    addScene(id, scene);
    refreshScenes();
  };

  const handleAddSceneDefault = () => {
    handleAddScene({
      title: "New Scene",
      chapter:
        scenes.length > 0 ? scenes[scenes.length - 1].chapter : "Chapter 1",
      summary: "",
      status: "planned",
      intent: "",
      pov: "",
    });
  };

  const handleFieldChange = (
    sceneId: string,
    field: "intent" | "pov" | "characters",
    value: string,
  ) => {
    if (field === "characters") {
      const chars = value.split(",").map((s) => s.trim()).filter(Boolean);
      updateSceneFields(id, sceneId, { characters: chars });
    } else {
      updateSceneFields(id, sceneId, { [field]: value });
    }
    refreshScenes();
  };

  const handleSceneJump = (_sceneId: string) => {
    setViewMode("corkboard");
  };

  const handleNoteInsert = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? content.length;
      const end = el.selectionEnd ?? content.length;
      const next = content.slice(0, start) + text + content.slice(end);
      setContent(next);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = start + text.length;
        el.selectionEnd = start + text.length;
      });
    },
    [content, setContent],
  );

  const unresolvedCollabCount = getUnresolvedCount(id);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(() =>
    getUnreadFeedbackCount(id),
  );
  const handleFeedbackRead = useCallback(() => setUnreadFeedbackCount(0), []);

  const {
    isFocusMode,
    typewriterScroll,
    enterFocus,
    exitFocus,
    toggleTypewriter,
    textareaRef,
  } = useFocusMode();
  const {
    timerState,
    elapsedMs,
    targetMs,
    startTimer,
    stopTimer,
    dismissSummary,
    wordsWritten,
  } = useSessionTimer();
  const { prefs } = useWriterPrefs();

  const hasFocusedOnOpen = useRef(false);

  // Apply focusByDefault pref after prefs hydrate from localStorage
  useEffect(() => {
    if (!hasFocusedOnOpen.current && prefs.focusByDefault) {
      hasFocusedOnOpen.current = true;
      enterFocus();
    }
  }, [prefs.focusByDefault, enterFocus]);
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const filteredSceneCount =
    corkboardStatusFilter === "all"
      ? scenes.length
      : scenes.filter((s) => s.status === corkboardStatusFilter).length;
  const sceneCountLabel =
    corkboardStatusFilter === "all"
      ? `${scenes.length} ${scenes.length === 1 ? "scene" : "scenes"}`
      : `${filteredSceneCount} of ${scenes.length} scenes`;

  return (
    <div
      className={styles.page}
      data-view-mode={viewMode}
      data-focus-mode={isFocusMode ? "true" : undefined}
      data-high-contrast={prefs.highContrast ? "true" : undefined}
      data-reduced-motion={prefs.reducedMotion ? "true" : undefined}
    >
      {/* COMMAND RAIL — single sticky row */}
      <div className={styles.commandRail}>
        <div className={styles.commandRailLeft}>
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Untitled Story"
            aria-label="Story title"
            value={storyTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
        </div>
        <div className={styles.commandRailCenter}>
          <ViewModeSwitch
            mode={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              scheduleUpdate({
                sceneId: focusedSceneId ?? null,
                cursorPosition: textareaRef.current?.selectionStart ?? 0,
                viewMode: mode,
              });
            }}
          />
        </div>
        <div className={styles.commandRailRight}>
          {viewMode === "editor" && (
            <SaveStatus
              saveState={saveState}
              lastSaved={lastSaved}
              onRetry={retrySave}
            />
          )}
          {viewMode === "corkboard" && (
            <span className={styles.saveStatusText}>
              {saveState === "saving" && "Saving…"}
              {(saveState === "saved" || (saveState === "idle" && lastSaved)) &&
                lastSaved &&
                "Saved"}
            </span>
          )}
          {viewMode === "submissions" && (
            <button
              className={styles.addSubmissionBtn}
              onClick={() => trackerRef.current?.openAddPanel()}
            >
              Add Submission
            </button>
          )}
          {viewMode === "editor" && !isFocusMode && (
            <div className={styles.commandRailRightGroup}>
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
              {storySeriesId && (
                <button
                  className={styles.seriesBibleBtn}
                  onClick={() => router.push(`/series/${storySeriesId}`)}
                  aria-label="Open Series Bible"
                >
                  Series
                </button>
              )}
              <button
                className={styles.sharePreviewBtn}
                onClick={() => setShowShareDialog(true)}
                aria-label="Share preview link"
              >
                Share
              </button>
            </div>
          )}
          {storySeriesId && (viewMode !== "editor" || isFocusMode) && (
            <button
              className={styles.seriesBibleBtn}
              onClick={() => router.push(`/series/${storySeriesId}`)}
              aria-label="Open Series Bible"
            >
              Series
            </button>
          )}
        </div>
      </div>

      {/* VIEW SUB-BAR — secondary corkboard controls only */}
      {viewMode === "corkboard" && (
        <div className={styles.viewSubBar}>
          <span className={styles.toolbarSceneCount}>{sceneCountLabel}</span>
          <div
            className={styles.toolbarFilterGroup}
            role="group"
            aria-label="Filter by status"
          >
            {(["all", "planned", "drafting", "done"] as const).map((s) => (
              <Tooltip key={s} content={CORKBOARD_FILTER_TOOLTIPS[s]}>
                <button
                  className={`${styles.filterBtn} ${corkboardStatusFilter === s ? styles.filterBtnActive : ""}`}
                  onClick={() => setCorkboardStatusFilter(s)}
                  aria-pressed={corkboardStatusFilter === s}
                >
                  {s === "all"
                    ? "All"
                    : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              </Tooltip>
            ))}
          </div>
          <Tooltip content="Add a new scene or story beat to your corkboard.">
            <button
              className={styles.addBeatBtn}
              onClick={handleAddSceneDefault}
              aria-label="Add new scene"
            >
              + Add beat
            </button>
          </Tooltip>
        </div>
      )}

      {/* SHELL BODY — view canvas */}
      <div className={styles.shellBody}>
        {viewMode === "editor" && (
          <div className={styles.editorLayout}>
            <div className={styles.editorMain}>
              <div className={styles.editorCanvas}>
                {showResumeIndicator && (
                  <div className={styles.bannerContainer}>
                    <ResumeIndicator
                      onDismiss={() => setShowResumeIndicator(false)}
                      optOut={optOut}
                      onOptOutChange={(v) => {
                        setOptOut(v);
                        setShowResumeIndicator(false);
                      }}
                    />
                  </div>
                )}
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
                      error={error ?? "Unknown error"}
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
                  onKeyUp={handleCursorChange}
                  onMouseUp={handleCursorChange}
                  data-typewriter-scroll={
                    typewriterScroll && isFocusMode ? "true" : undefined
                  }
                  style={{
                    fontSize: prefs.fontSize,
                    lineHeight: prefs.lineHeight,
                    maxWidth: prefs.editorWidth,
                  }}
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
            <aside
              className={`${styles.sidebar} ${sidebarTab ? styles.sidebarOpen : ""}`}
            >
              <div
                className={styles.sidebarTabBar}
                role="tablist"
                aria-label="Sidebar panels"
              >
                <button
                  role="tab"
                  id="tab-notes"
                  aria-selected={sidebarTab === "notes"}
                  aria-controls="panel-notes"
                  className={`${styles.sidebarTab} ${sidebarTab === "notes" ? styles.sidebarTabActive : ""}`}
                  onClick={() => setSidebarTab("notes")}
                >
                  Notes
                </button>
                <button
                  role="tab"
                  id="tab-revision"
                  aria-selected={sidebarTab === "revision"}
                  aria-controls="panel-revision"
                  className={`${styles.sidebarTab} ${sidebarTab === "revision" ? styles.sidebarTabActive : ""}`}
                  onClick={() => setSidebarTab("revision")}
                >
                  Revision
                </button>
                <button
                  role="tab"
                  id="tab-collab"
                  aria-selected={sidebarTab === "collab"}
                  aria-controls="panel-collab"
                  className={`${styles.sidebarTab} ${sidebarTab === "collab" ? styles.sidebarTabActive : ""} ${styles.sidebarTabWithBadge}`}
                  onClick={() => setSidebarTab("collab")}
                >
                  Collab
                  <CollabBadge count={unresolvedCollabCount} />
                </button>
                <button
                  role="tab"
                  id="tab-feedback"
                  aria-selected={sidebarTab === "feedback"}
                  aria-controls="panel-feedback"
                  className={`${styles.sidebarTab} ${sidebarTab === "feedback" ? styles.sidebarTabActive : ""} ${styles.sidebarTabWithBadge}`}
                  onClick={() => setSidebarTab("feedback")}
                >
                  Feedback
                  <CollabBadge count={unreadFeedbackCount} />
                </button>
              </div>
              {sidebarTab === "notes" ? (
                <div
                  role="tabpanel"
                  id="panel-notes"
                  aria-labelledby="tab-notes"
                  className={styles.sidebarPanelFull}
                >
                  <NotesPanel
                    storyId={id}
                    scenes={scenes}
                    focusedSceneId={focusedSceneId}
                    onInsert={handleNoteInsert}
                  />
                </div>
              ) : sidebarTab === "revision" ? (
                <div
                  role="tabpanel"
                  id="panel-revision"
                  aria-labelledby="tab-revision"
                  className={styles.sidebarPanelFull}
                >
                  <RevisionPassPanel
                    storyId={id}
                    storyTitle={storyTitle}
                    scenes={scenes}
                    onSceneJump={handleSceneJump}
                  />
                </div>
              ) : sidebarTab === "feedback" ? (
                <div
                  role="tabpanel"
                  id="panel-feedback"
                  aria-labelledby="tab-feedback"
                  className={styles.sidebarPanelFull}
                >
                  <PreviewFeedbackPanel
                    storyId={id}
                    onRead={handleFeedbackRead}
                  />
                </div>
              ) : (
                <div
                  role="tabpanel"
                  id="panel-collab"
                  aria-labelledby="tab-collab"
                  className={styles.sidebarPanelFull}
                >
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

        {viewMode === "corkboard" && (
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
            focusedSceneId={focusedSceneId}
            onFocusClear={() => setFocusedSceneId(null)}
          />
        )}

        {viewMode === "pacing" && (
          <div className={styles.pacingContainer}>
            <PacingBoard
              storyId={id}
              scenes={scenes}
              onJumpToScene={(sceneId) => {
                setFocusedSceneId(sceneId);
                setViewMode("corkboard");
              }}
            />
          </div>
        )}

        {viewMode === "submissions" && (
          <SubmissionTracker ref={trackerRef} storyId={id} />
        )}

        {viewMode === "diagnostics" && (
          <div className={styles.diagnosticsContainer}>
            <DiagnosticsBoard
              storyId={id}
              scenes={scenes}
              onJumpToScene={(sceneId) => {
                setFocusedSceneId(sceneId);
                setViewMode("corkboard");
              }}
            />
          </div>
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
