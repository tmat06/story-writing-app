'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStories, createStory } from '@/lib/stories';
import { getSeries } from '@/lib/series';
import { Series } from '@/types/series';
import StoryCard from '@/components/StoryCard/StoryCard';
import StoryBundleDialog from '@/components/StoryBundleDialog/StoryBundleDialog';
import styles from './page.module.css';

export default function StoriesPage() {
  const [stories, setStories] = useState<ReturnType<typeof getStories>>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setStories(getStories());
    setAllSeries(getSeries());
  }, []);

  const filteredStories = stories.filter(s => s.isArchived === showArchived);

  const handleUpdate = () => {
    setStories(getStories());
    setAllSeries(getSeries());
  };

  const handleNavigate = (id: string) => {
    router.push(`/story/${id}`);
  };

  const handleCreateStory = () => {
    setIsCreating(true);
    const newStory = createStory('Untitled Story');
    router.push(`/story/${newStory.id}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <button
          className={styles.newStoryButton}
          onClick={handleCreateStory}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'New Story'}
        </button>
        <div className={styles.searchWrapper}>
          <label htmlFor="story-search" className={styles.visuallyHidden}>
            Search stories
          </label>
          <input
            type="text"
            id="story-search"
            className={styles.searchInput}
            placeholder="Search stories..."
            aria-label="Search stories"
          />
        </div>
        <button
          className={styles.importBundleButton}
          onClick={() => setImportDialogOpen(true)}
        >
          Import Bundle
        </button>
        <button
          className={styles.archiveToggle}
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      <div className={styles.storiesList}>
        {filteredStories.length > 0 ? (
          <div className={styles.storiesGrid}>
            {filteredStories.map(story => (
              <StoryCard
                key={story.id}
                story={story}
                showActions={true}
                availableSeries={allSeries}
                onUpdate={handleUpdate}
                onClick={() => handleNavigate(story.id)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {!showArchived ? (
              <>
                <p className={styles.emptyTitle}>No stories yet</p>
                <p className={styles.emptyText}>
                  Create your first story to get started
                </p>
              </>
            ) : (
              <>
                <p className={styles.emptyTitle}>No archived stories</p>
                <p className={styles.emptyText}>
                  Archive a story to see it here
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <StoryBundleDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportComplete={(newStoryId) => {
          setImportDialogOpen(false);
          handleUpdate();
          router.push(`/story/${newStoryId}`);
        }}
      />
    </div>
  );
}
