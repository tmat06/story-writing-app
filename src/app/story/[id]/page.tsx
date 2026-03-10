'use client';

import { useState, useEffect, use } from 'react';
import { ViewModeSwitch, type ViewMode } from '@/components/ViewModeSwitch/ViewModeSwitch';
import { Corkboard } from '@/components/Corkboard/Corkboard';
import { getScenes, updateSceneOrder, updateSceneStatus, updateSceneMetadata } from '@/lib/scenes';
import type { Scene, SceneStatus } from '@/types/scene';
import { MetadataRow } from '@/components/MetadataRow/MetadataRow';
import styles from './page.module.css';

interface StoryPageProps {
  params: Promise<{ id: string }>;
}

export default function StoryPage({ params }: StoryPageProps) {
  const { id } = use(params);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setLoading] = useState(true);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const metadataDebounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

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
    const scene = scenes.find((s) => s.id === sceneId) ?? null;
    setSelectedScene(scene);
    setViewMode('editor');
  };

  const handleMetadataChange = (field: 'pov' | 'location' | 'timeframe', value: string) => {
    if (!selectedScene) return;

    const updated = { ...selectedScene, [field]: value };
    setSelectedScene(updated);
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

    if (metadataDebounceRef[0]) clearTimeout(metadataDebounceRef[0]);
    metadataDebounceRef[0] = setTimeout(() => {
      updateSceneMetadata(id, updated.id, { [field]: value });
    }, 500);
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
              <div className={styles.editorHeaderTop}>
                <input
                  type="text"
                  className={styles.titleInput}
                  placeholder="Untitled Story"
                  aria-label="Story title"
                  defaultValue={`Story ${id}`}
                />
                <ViewModeSwitch mode={viewMode} onChange={setViewMode} />
              </div>
              {selectedScene && (
                <div className={styles.metadataRowWrapper}>
                  <MetadataRow
                    pov={selectedScene.pov}
                    location={selectedScene.location}
                    timeframe={selectedScene.timeframe}
                    onChange={handleMetadataChange}
                  />
                </div>
              )}
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
