'use client';

import { useState, useEffect, use } from 'react';
import { ViewModeSwitch, type ViewMode } from '@/components/ViewModeSwitch/ViewModeSwitch';
import { Corkboard } from '@/components/Corkboard/Corkboard';
import { SubmissionTracker } from '@/components/SubmissionTracker/SubmissionTracker';
import { getScenes, updateSceneOrder, updateSceneStatus } from '@/lib/scenes';
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

  // Load scenes for corkboard view
  useEffect(() => {
    setLoading(true);
    const loadedScenes = getScenes(id);
    setScenes(loadedScenes);
    setLoading(false);
  }, [id]);

  // Refresh scenes after updates
  const refreshScenes = () => {
    const refreshedScenes = getScenes(id);
    setScenes(refreshedScenes);
  };

  const handleSceneClick = (sceneId: string) => {
    // TODO: Navigate to specific scene in editor
    console.log('Navigate to scene:', sceneId);
  };

  const handleSceneReorder = (sceneId: string, newOrder: number) => {
    updateSceneOrder(id, sceneId, newOrder);
    refreshScenes(); // Re-fetch after update
  };

  const handleSceneStatusChange = (sceneId: string, status: SceneStatus) => {
    updateSceneStatus(id, sceneId, status);
    refreshScenes(); // Re-fetch after update
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
            </div>
            <div className={styles.editorCanvas}>
              <label htmlFor="story-editor" className={styles.visuallyHidden}>
                Story content editor
              </label>
              <textarea
                id="story-editor"
                className={styles.editor}
                placeholder="Start writing your story..."
                aria-label="Story content editor"
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
          </div>
          <Corkboard
            scenes={scenes}
            loading={scenesLoading}
            onSceneClick={handleSceneClick}
            onReorder={handleSceneReorder}
            onStatusChange={handleSceneStatusChange}
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
