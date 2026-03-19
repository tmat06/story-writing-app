'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { CanonEntityType, CanonEntity, Series } from '@/types/series';
import { Story } from '@/types/story';
import { getSeries, getSeriesById } from '@/lib/series';
import {
  getCanonEntities,
  createCanonEntity,
  updateCanonEntity,
  getSceneEntityLinks,
  getEntityImpactSummary,
} from '@/lib/canon';
import { getStories } from '@/lib/stories';
import SeriesSwitcher from '@/components/SeriesSwitcher/SeriesSwitcher';
import CanonTypeTabs from '@/components/CanonTypeTabs/CanonTypeTabs';
import CanonEntityTable from '@/components/CanonEntityTable/CanonEntityTable';
import EntityReferenceList from '@/components/EntityReferenceList/EntityReferenceList';
import CanonImpactWarningDialog from '@/components/CanonImpactWarningDialog/CanonImpactWarningDialog';
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

  // Impact warning state
  const [pendingUpdate, setPendingUpdate] = useState<{
    id: string;
    updates: Partial<Pick<CanonEntity, 'name' | 'summary' | 'tags'>>;
  } | null>(null);
  const [impactSummary, setImpactSummary] = useState<{
    storyCount: number;
    sceneCount: number;
  } | null>(null);

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
    setStories(getStories());
  }, [seriesId, router]);

  const refreshEntities = () => {
    const e = getCanonEntities(seriesId);
    setAllEntities(e);
    setEntities(e.filter(en => en.type === activeType));
  };

  useEffect(() => {
    if (!currentSeries) return;
    refreshEntities();
    setSelectedEntityId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, activeType, currentSeries]);

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

  const selectedEntity = allEntities.find(e => e.id === selectedEntityId) ?? null;
  const selectedLinks = selectedEntityId ? getSceneEntityLinks(selectedEntityId) : [];

  const counts: Record<CanonEntityType, number> = {
    character: allEntities.filter(e => e.type === 'character').length,
    location: allEntities.filter(e => e.type === 'location').length,
    lore: allEntities.filter(e => e.type === 'lore').length,
  };

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
          links={selectedLinks}
          stories={stories}
          onUpdateEntity={handleUpdateEntity}
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
    </div>
  );
}
