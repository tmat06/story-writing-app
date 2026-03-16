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
import styles from './Corkboard.module.css';

interface CorkboardProps {
  storyId: string;
  scenes: Scene[];
  onSceneClick: (sceneId: string) => void;
  onReorder: (sceneId: string, newOrder: number) => void;
  onStatusChange: (sceneId: string, status: SceneStatus) => void;
  onAddScene: (scene: Omit<Scene, 'id' | 'order'>) => void;
  onFieldChange: (sceneId: string, field: 'intent' | 'pov', value: string) => void;
  loading?: boolean;
}

interface SortableSceneCardProps {
  storyId: string;
  scene: Scene;
  onClick: () => void;
  onStatusChange: (status: SceneStatus) => void;
  onFieldChange: (field: 'intent' | 'pov', value: string) => void;
}

function SortableSceneCard({
  storyId,
  scene,
  onClick,
  onStatusChange,
  onFieldChange,
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
        storyId={storyId}
        scene={scene}
        onClick={onClick}
        onStatusChange={onStatusChange}
        onFieldChange={onFieldChange}
        isDragging={isDragging}
      />
    </div>
  );
}

function SkeletonCard() {
  return <div className={styles.skeleton} />;
}

const STARTER_BEATS: Omit<Scene, 'id' | 'order'>[] = [
  {
    title: 'Act 1 Setup',
    chapter: 'Chapter 1',
    summary: '',
    status: 'planned',
    intent: 'Establish world and protagonist',
    pov: '',
  },
  {
    title: 'First Turn',
    chapter: 'Chapter 1',
    summary: '',
    status: 'planned',
    intent: 'Disrupt the status quo',
    pov: '',
  },
  {
    title: 'Commitment',
    chapter: 'Chapter 1',
    summary: '',
    status: 'planned',
    intent: 'Lock protagonist into the journey',
    pov: '',
  },
];

export function Corkboard({
  storyId,
  scenes: initialScenes,
  onSceneClick,
  onReorder,
  onStatusChange,
  onAddScene,
  onFieldChange,
  loading = false,
}: CorkboardProps) {
  const [scenes, setScenes] = useState(initialScenes);
  const [statusFilter, setStatusFilter] = useState<SceneStatus | 'all'>('all');

  useEffect(() => {
    setScenes(initialScenes);
  }, [initialScenes]);

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

        const newOrder = newIndex + 1;
        onReorder(active.id as string, newOrder);
      }
    }
  };

  const displayScenes =
    statusFilter === 'all' ? scenes : scenes.filter((s) => s.status === statusFilter);

  const toolbar = (
    <div className={styles.toolbar} role="toolbar" aria-label="Scene planning controls">
      <span className={styles.sceneCount}>
        {statusFilter === 'all'
          ? `${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'}`
          : `${displayScenes.length} of ${scenes.length} scenes`}
      </span>
      <div className={styles.toolbarRight}>
        <div className={styles.filterGroup} role="group" aria-label="Filter by status">
          {(['all', 'planned', 'drafting', 'done'] as const).map((s) => (
            <button
              key={s}
              className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button
          className={styles.addSceneBtn}
          onClick={() =>
            onAddScene({
              title: 'New Scene',
              chapter: scenes.length > 0 ? scenes[scenes.length - 1].chapter : 'Chapter 1',
              summary: '',
              status: 'planned',
              intent: '',
              pov: '',
            })
          }
          aria-label="Add new scene"
        >
          + Add beat
        </button>
      </div>
    </div>
  );

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
        {toolbar}
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Start planning your story</h2>
          <p className={styles.emptyBody}>
            Add beats one by one, or start with these suggested scenes:
          </p>
          <div className={styles.starterBeats}>
            {STARTER_BEATS.map((beat) => (
              <button
                key={beat.title}
                className={styles.starterBeat}
                onClick={() => onAddScene(beat)}
              >
                <span className={styles.starterBeatTitle}>{beat.title}</span>
                <span className={styles.starterBeatIntent}>{beat.intent}</span>
              </button>
            ))}
          </div>
          <button
            className={styles.addSceneBtn}
            onClick={() =>
              onAddScene({
                title: 'New Scene',
                chapter: 'Chapter 1',
                summary: '',
                status: 'planned',
                intent: '',
                pov: '',
              })
            }
          >
            + Create first beat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {toolbar}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={scenes.map((s) => s.id)}
          strategy={rectSortingStrategy}
        >
          <div className={styles.grid} role="list">
            {displayScenes.map((scene) => (
              <SortableSceneCard
                key={scene.id}
                storyId={storyId}
                scene={scene}
                onClick={() => onSceneClick(scene.id)}
                onStatusChange={(status) => onStatusChange(scene.id, status)}
                onFieldChange={(field, value) => onFieldChange(scene.id, field, value)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
