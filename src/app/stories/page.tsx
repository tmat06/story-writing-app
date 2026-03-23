'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStories, createStory } from '@/lib/stories';
import { initScenesForStory } from '@/lib/scenes';
import { getSeries } from '@/lib/series';
import { Series } from '@/types/series';
import StoryCard from '@/components/StoryCard/StoryCard';
import StoryBundleDialog from '@/components/StoryBundleDialog/StoryBundleDialog';
import StartStoryDialog from '@/components/StartStoryDialog/StartStoryDialog';
import styles from './page.module.css';

function StoriesPageInner() {
  const [stories, setStories] = useState<ReturnType<typeof getStories>>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived' | 'series'>('all');
  const [sort, setSort] = useState<'updated' | 'title' | 'created'>('updated');

  useEffect(() => {
    setStories(getStories());
    setAllSeries(getSeries());
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const f = searchParams.get('filter') ?? 'all';
    const s = searchParams.get('sort') ?? 'updated';
    setSearchQuery(q);
    setFilter(f as 'all' | 'active' | 'archived' | 'series');
    setSort(s as 'updated' | 'title' | 'created');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (filter !== 'all') params.set('filter', filter);
    if (sort !== 'updated') params.set('sort', sort);
    const qs = params.toString();
    router.replace(qs ? `/stories?${qs}` : '/stories', { scroll: false });
  }, [searchQuery, filter, sort]);

  const filteredStories = useMemo(() => {
    let result = stories;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => s.title.toLowerCase().includes(q));
    }

    if (filter === 'active')   result = result.filter(s => !s.isArchived);
    if (filter === 'archived') result = result.filter(s => s.isArchived);
    if (filter === 'series')   result = result.filter(s => !!s.seriesId);

    if (sort === 'title')   return [...result].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'created') return [...result].sort((a, b) => b.createdAt - a.createdAt);
    return [...result].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [stories, searchQuery, filter, sort]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setFilter('all');
    setSort('updated');
  };

  const handleUpdate = () => {
    setStories(getStories());
    setAllSeries(getSeries());
  };

  const handleNavigate = (id: string) => {
    router.push(`/story/${id}`);
  };

  const handleQuickCreate = (mode: 'blank' | 'starter') => {
    setIsCreating(true);
    const newStory = createStory('Untitled Story', { startMode: mode });
    initScenesForStory(newStory.id, mode);
    router.push(`/story/${newStory.id}`);
  };

  const handleCreateStory = () => {
    setStartDialogOpen(true);
  };

  // Cmd/Ctrl+N quick-creates a blank story without the dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (!isCreating) handleQuickCreate('blank');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreating]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        {/* Zone 1: Primary action (left) */}
        <div className={styles.toolbarPrimary}>
          <button
            className={styles.newStoryButton}
            onClick={handleCreateStory}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'New Story'}
          </button>
        </div>

        {/* Zone 2: Discovery controls (center) */}
        <div className={styles.toolbarDiscovery}>
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
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Zone 3: Utility toggles (right) */}
        <div className={styles.toolbarUtility}>
          <button
            className={styles.importBundleButton}
            onClick={() => setImportDialogOpen(true)}
          >
            Import Bundle
          </button>
        </div>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.filterPills} role="group" aria-label="Filter stories">
          {(['all', 'active', 'archived', 'series'] as const).map(f => (
            <button
              key={f}
              className={filter === f ? styles.filterPillActive : styles.filterPill}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'archived' ? 'Archived' : 'Series-linked'}
            </button>
          ))}
        </div>
        <label htmlFor="story-sort" className={styles.visuallyHidden}>Sort stories</label>
        <select
          id="story-sort"
          className={styles.sortSelect}
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          aria-label="Sort stories"
        >
          <option value="updated">Last edited (newest)</option>
          <option value="title">Title (A–Z)</option>
          <option value="created">Created (newest)</option>
        </select>
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
            {(searchQuery || filter !== 'all') ? (
              <>
                <p className={styles.emptyTitle}>No stories match your search</p>
                <p className={styles.emptyText}>
                  Try a different keyword or clear the filters.
                </p>
                <div className={styles.emptyStateActions}>
                  <button className={styles.clearSearchButton} onClick={handleClearSearch}>
                    Clear search
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.emptyTitle}>No stories yet</p>
                <p className={styles.emptyText}>Create your first story to get started</p>
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

      <StartStoryDialog
        isOpen={startDialogOpen}
        onClose={() => setStartDialogOpen(false)}
        onConfirm={(mode) => {
          setStartDialogOpen(false);
          handleQuickCreate(mode);
        }}
        isCreating={isCreating}
      />
    </div>
  );
}

export default function StoriesPage() {
  return (
    <Suspense>
      <StoriesPageInner />
    </Suspense>
  );
}
