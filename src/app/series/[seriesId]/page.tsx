'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { CanonEntityType, CanonEntity, SceneEntityLink, Series } from '@/types/series';
import { Story } from '@/types/story';
import { getSeries, getSeriesById } from '@/lib/series';
import {
  getCanonEntities,
  createCanonEntity,
  updateCanonEntity,
  getSceneEntityLinks,
  getEntityImpactSummary,
  linkEntityToScene,
  unlinkEntityFromScene,
} from '@/lib/canon';
import { getStories, updateStory } from '@/lib/stories';
import SeriesSwitcher from '@/components/SeriesSwitcher/SeriesSwitcher';
import CanonTypeTabs from '@/components/CanonTypeTabs/CanonTypeTabs';
import CanonEntityTable from '@/components/CanonEntityTable/CanonEntityTable';
import EntityReferenceList from '@/components/EntityReferenceList/EntityReferenceList';
import CanonImpactWarningDialog from '@/components/CanonImpactWarningDialog/CanonImpactWarningDialog';
import SceneLinkDialog from '@/components/SceneLinkDialog/SceneLinkDialog';
import styles from './page.module.css';

interface SeriesBiblePageProps {
  params: Promise<{ seriesId: string }>;
}

export default function SeriesBiblePage({ params }: SeriesBiblePageProps) {
  const { seriesId } = use(params);
  const router = useRouter();

  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [currentSeries, setCurrentSeries] = useState<Series | null>(null);
  const [activeType, setActiveType] = useState<CanonEntityType>('character');
  const [entities, setEntities] = useState<CanonEntity[]>([]);
  const [allEntities, setAllEntities] = useState<CanonEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stories, setStories] = useState<Story[]>([]);

  // Stories in this series
  const [seriesStories, setSeriesStories] = useState<Story[]>([]);
  const [showAddStoryPicker, setShowAddStoryPicker] = useState(false);
  const [selectedAddStoryId, setSelectedAddStoryId] = useState('');

  // Impact warning state
  const [pendingUpdate, setPendingUpdate] = useState<{
    id: string;
    updates: Partial<Pick<CanonEntity, 'name' | 'summary' | 'tags'>>;
  } | null>(null);
  const [impactSummary, setImpactSummary] = useState<{
    storyCount: number;
    sceneCount: number;
  } | null>(null);

  // Scene link dialog state
  const [showSceneLinkDialog, setShowSceneLinkDialog] = useState(false);
  const [entityLinks, setEntityLinks] = useState<SceneEntityLink[]>([]);

  // Load data
  useEffect(() => {
    const all = getSeries();
    setAllSeries(all);
    const series = getSeriesById(seriesId);
    if (!series) {
      if (all.length > 0) {
        router.replace(`/series/${all[0].id}`);
      } else {
        router.replace('/series/new');
      }
      return;
    }
    setCurrentSeries(series);
    const allStories = getStories();
    setStories(allStories);
    setSeriesStories(allStories.filter(s => s.seriesId === seriesId));
  }, [seriesId, router]);

  const refreshEntities = () => {
    const e = getCanonEntities(seriesId);
    setAllEntities(e);
    setEntities(e.filter(en => en.type === activeType));
  };

  const refreshSeriesStories = () => {
    const allStories = getStories();
    setStories(allStories);
    setSeriesStories(allStories.filter(s => s.seriesId === seriesId));
  };

  useEffect(() => {
    if (!currentSeries) return;
    refreshEntities();
    setSelectedEntityId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, activeType, currentSeries]);

  // Refresh entity links when selected entity changes
  useEffect(() => {
    if (selectedEntityId) {
      setEntityLinks(getSceneEntityLinks(selectedEntityId));
    } else {
      setEntityLinks([]);
    }
  }, [selectedEntityId]);

  const handleSelectType = (type: CanonEntityType) => {
    setActiveType(type);
    setSelectedEntityId(null);
  };

  const handleCreateEntity = (name: string, summary: string) => {
    const entity = createCanonEntity(seriesId, activeType, name, summary);
    refreshEntities();
    setSelectedEntityId(entity.id);
  };

  const handleUpdateEntity = (
    id: string,
    updates: Partial<Pick<CanonEntity, 'name' | 'summary' | 'tags'>>
  ) => {
    const impact = getEntityImpactSummary(id);
    if (impact.storyCount > 0) {
      setPendingUpdate({ id, updates });
      setImpactSummary(impact);
    } else {
      applyEntityUpdate(id, updates);
    }
  };

  const applyEntityUpdate = (
    id: string,
    updates: Partial<Pick<CanonEntity, 'name' | 'summary' | 'tags'>>
  ) => {
    updateCanonEntity(id, updates);
    refreshEntities();
  };

  const handleImpactConfirm = () => {
    if (!pendingUpdate) return;
    applyEntityUpdate(pendingUpdate.id, pendingUpdate.updates);
    setPendingUpdate(null);
    setImpactSummary(null);
  };

  const handleImpactCancel = () => {
    setPendingUpdate(null);
    setImpactSummary(null);
  };

  const handleSeriesSwitch = (id: string) => {
    router.push(`/series/${id}`);
  };

  const handleCreateSeries = () => {
    router.push('/series/new');
  };

  const handleAddStory = () => {
    if (!selectedAddStoryId) return;
    updateStory(selectedAddStoryId, { seriesId });
    setSelectedAddStoryId('');
    setShowAddStoryPicker(false);
    refreshSeriesStories();
  };

  const handleRemoveStory = (storyId: string) => {
    updateStory(storyId, { seriesId: undefined });
    refreshSeriesStories();
  };

  const handleLinkToScene = (storyId: string, sceneId: string) => {
    if (!selectedEntityId) return;
    linkEntityToScene(selectedEntityId, storyId, sceneId);
    setEntityLinks(getSceneEntityLinks(selectedEntityId));
  };

  const handleUnlink = (linkId: string) => {
    unlinkEntityFromScene(linkId);
    if (selectedEntityId) {
      setEntityLinks(getSceneEntityLinks(selectedEntityId));
    }
  };

  const selectedEntity = allEntities.find(e => e.id === selectedEntityId) ?? null;

  const counts = useMemo(() => ({
    character: allEntities.filter(e => e.type === 'character').length,
    location: allEntities.filter(e => e.type === 'location').length,
    lore: allEntities.filter(e => e.type === 'lore').length,
  }), [allEntities]);

  // Unassigned stories (not in any series) for the add picker
  const unassignedStories = stories.filter(s => !s.seriesId && !s.isArchived);

  if (!currentSeries) {
    return (
      <div className={styles.loading}>
        <p>Loading series…</p>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* Left rail */}
      <aside className={styles.leftRail}>
        <SeriesSwitcher
          series={allSeries}
          currentSeriesId={seriesId}
          onSelect={handleSeriesSwitch}
          onCreateSeries={handleCreateSeries}
        />
        <CanonTypeTabs
          activeType={activeType}
          onChange={handleSelectType}
          counts={counts}
        />

        {/* Stories in this series */}
        <div className={styles.storiesSection}>
          <h3 className={styles.storiesSectionTitle}>Stories in this series</h3>
          <ul className={styles.storiesList}>
            {seriesStories.map(story => (
              <li key={story.id} className={styles.storyRow}>
                <span className={styles.storyRowTitle} title={story.title}>{story.title}</span>
                <button
                  type="button"
                  className={styles.storyRemoveButton}
                  onClick={() => handleRemoveStory(story.id)}
                  aria-label={`Remove ${story.title} from series`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {showAddStoryPicker ? (
            <div className={styles.addStoryPicker}>
              {unassignedStories.length === 0 ? (
                <p className={styles.noUnassigned}>All stories are assigned to a series</p>
              ) : (
                <>
                  <select
                    className={styles.storySelect}
                    value={selectedAddStoryId}
                    onChange={e => setSelectedAddStoryId(e.target.value)}
                    aria-label="Select story to add"
                  >
                    <option value="">Select a story…</option>
                    {unassignedStories.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                  <div className={styles.addStoryActions}>
                    <button
                      type="button"
                      className={styles.addStoryConfirmButton}
                      onClick={handleAddStory}
                      disabled={!selectedAddStoryId}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className={styles.addStoryCancelButton}
                      onClick={() => {
                        setShowAddStoryPicker(false);
                        setSelectedAddStoryId('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              className={styles.addStoryButton}
              onClick={() => setShowAddStoryPicker(true)}
            >
              + Add story
            </button>
          )}
        </div>
      </aside>

      {/* Center column */}
      <main className={styles.center}>
        <CanonEntityTable
          entities={entities}
          selectedId={selectedEntityId}
          onSelect={setSelectedEntityId}
          onCreateEntity={handleCreateEntity}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeType={activeType}
        />
      </main>

      {/* Right panel */}
      <aside className={styles.rightPanel}>
        <EntityReferenceList
          entity={selectedEntity}
          links={entityLinks}
          stories={stories}
          onUpdateEntity={handleUpdateEntity}
          onOpenSceneLinkDialog={() => setShowSceneLinkDialog(true)}
        />
      </aside>

      {/* Impact warning dialog */}
      {impactSummary && pendingUpdate && (
        <CanonImpactWarningDialog
          open
          entityName={allEntities.find(e => e.id === pendingUpdate.id)?.name ?? ''}
          impactSummary={impactSummary}
          onConfirm={handleImpactConfirm}
          onCancel={handleImpactCancel}
        />
      )}

      {/* Scene link dialog */}
      {showSceneLinkDialog && selectedEntity && (
        <SceneLinkDialog
          open={showSceneLinkDialog}
          entity={selectedEntity}
          seriesStories={seriesStories}
          existingLinks={entityLinks}
          onLink={handleLinkToScene}
          onUnlink={handleUnlink}
          onClose={() => setShowSceneLinkDialog(false)}
        />
      )}
    </div>
  );
}
