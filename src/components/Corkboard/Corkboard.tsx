import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Scene, SceneStatus } from '@/types/scene';
import { SceneCard } from '@/components/SceneCard/SceneCard';
import { MetadataFilters } from '@/components/MetadataFilters/MetadataFilters';
import styles from './Corkboard.module.css';

interface CorkboardProps {
  scenes: Scene[];
  onSceneClick: (sceneId: string) => void;
  onReorder: (sceneId: string, newOrder: number) => void;
  onStatusChange: (sceneId: string, status: SceneStatus) => void;
  loading?: boolean;
}

interface SortableSceneCardProps {
  scene: Scene;
  onClick: () => void;
  onStatusChange: (status: SceneStatus) => void;
}

function SortableSceneCard({
  scene,
  onClick,
  onStatusChange,
}: SortableSceneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SceneCard
        scene={scene}
        onClick={onClick}
        onStatusChange={onStatusChange}
        isDragging={isDragging}
      />
    </div>
  );
}

function SkeletonCard() {
  return <div className={styles.skeleton} />;
}

export function Corkboard({
  scenes: initialScenes,
  onSceneClick,
  onReorder,
  onStatusChange,
  loading = false,
}: CorkboardProps) {
  const [scenes, setScenes] = useState(initialScenes);
  const [activePov, setActivePov] = useState<string | null>(null);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState<string | null>(null);

  useEffect(() => {
    setScenes(initialScenes);
  }, [initialScenes]);

  const povOptions = Array.from(new Set(scenes.map((s) => s.pov).filter((v): v is string => Boolean(v)))).sort();
  const locationOptions = Array.from(new Set(scenes.map((s) => s.location).filter((v): v is string => Boolean(v)))).sort();
  const timeframeOptions = Array.from(new Set(scenes.map((s) => s.timeframe).filter((v): v is string => Boolean(v)))).sort();

  const filteredScenes = scenes.filter((scene) => {
    if (activePov && scene.pov !== activePov) return false;
    if (activeLocation && scene.location !== activeLocation) return false;
    if (activeTimeframe && scene.timeframe !== activeTimeframe) return false;
    return true;
  });

  const hasActiveFilters = activePov !== null || activeLocation !== null || activeTimeframe !== null;

  const handleFilterChange = (field: 'pov' | 'location' | 'timeframe', value: string | null) => {
    console.log(`Applied filters: POV=${activePov}, Location=${activeLocation}, Timeframe=${activeTimeframe}`);
    if (field === 'pov') setActivePov(value);
    else if (field === 'location') setActiveLocation(value);
    else if (field === 'timeframe') setActiveTimeframe(value);
  };

  const handleClearFilters = () => {
    setActivePov(null);
    setActiveLocation(null);
    setActiveTimeframe(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedScenes = arrayMove(scenes, oldIndex, newIndex);
        setScenes(reorderedScenes);

        // Call the callback with the new order
        const newOrder = newIndex + 1;
        onReorder(active.id as string, newOrder);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <span className={styles.sceneCount}>Loading...</span>
          <div className={styles.toolbarRight} />
        </div>
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <span className={styles.sceneCount}>0 scenes</span>
          <div className={styles.toolbarRight} />
        </div>
        <div className={styles.emptyState}>
          <p>No scenes yet. Create your first scene to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Scene planning controls"
      >
        <span className={styles.sceneCount}>
          {hasActiveFilters
            ? `${filteredScenes.length} of ${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'}`
            : `${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'}`}
        </span>
        <div className={styles.toolbarRight}>
          <MetadataFilters
            povOptions={povOptions}
            locationOptions={locationOptions}
            timeframeOptions={timeframeOptions}
            activePov={activePov}
            activeLocation={activeLocation}
            activeTimeframe={activeTimeframe}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearFilters}
          />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={scenes.map((s) => s.id)}
          strategy={rectSortingStrategy}
        >
          {filteredScenes.length === 0 && hasActiveFilters ? (
            <div className={styles.emptyState}>
              <p>No scenes match the active filters.</p>
              <button
                className={styles.clearFiltersLink}
                onClick={handleClearFilters}
                type="button"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className={styles.grid} role="list">
              {filteredScenes.map((scene) => (
                <SortableSceneCard
                  key={scene.id}
                  scene={scene}
                  onClick={() => onSceneClick(scene.id)}
                  onStatusChange={(status) => onStatusChange(scene.id, status)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
