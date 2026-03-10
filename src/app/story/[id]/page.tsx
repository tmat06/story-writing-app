'use client';

import { useState, use } from 'react';
import { ViewModeSwitch, type ViewMode } from '@/components/ViewModeSwitch/ViewModeSwitch';
import { Corkboard } from '@/components/Corkboard/Corkboard';
import { getScenes, updateSceneOrder, updateSceneStatus } from '@/lib/scenes';
import type { SceneStatus } from '@/types/scene';
import styles from './page.module.css';

interface StoryPageProps {
  params: Promise<{ id: string }>;
}

export default function StoryPage({ params }: StoryPageProps) {
  const { id } = use(params);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');

  // Load scenes for corkboard view
  const scenes = getScenes(id);

  const handleSceneClick = (sceneId: string) => {
    // TODO: Navigate to specific scene in editor
    console.log('Navigate to scene:', sceneId);
  };

  const handleSceneReorder = (sceneId: string, newOrder: number) => {
    updateSceneOrder(id, sceneId, newOrder);
  };

  const handleSceneStatusChange = (sceneId: string, status: SceneStatus) => {
    updateSceneStatus(id, sceneId, status);
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
                defaultValue={`Story ${id}`}
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
          </div>
          <Corkboard
            scenes={scenes}
            onSceneClick={handleSceneClick}
            onReorder={handleSceneReorder}
            onStatusChange={handleSceneStatusChange}
          />
        </div>
      )}
    </div>
  );
}
